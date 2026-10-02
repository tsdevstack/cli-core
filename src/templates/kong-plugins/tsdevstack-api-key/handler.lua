-- tsdevstack-api-key (framework plugin, set on each partner service).
--
-- Validates runtime-managed API keys against the Redis index the key owner
-- (the auth-service template, or a project's own tooling) maintains, and
-- enforces the key's per-window limits. The Redis layout and the record
-- format are a public, versioned contract, defined in @tsdevstack/nest-common
-- (src/api-keys).
--
-- Per request:
--   1. Exactly one key value in the configured headers, else 401.
--   2. <h> = sha256 hex of the key; every Redis key name is built here and
--      hash-tagged on <h> (apikey:{<h>}:...), so the script stays in one slot.
--   3. One script call (EVALSHA, EVAL once on NOSCRIPT): record checks, then
--      per-window limits (the key's own limit, else default_limits), then the
--      counters are incremented only if the request is admitted.
--   4. No record: a separate single-key GET of the index marker apikey:meta
--      (another hash slot, so never part of the script). Marker present:
--      401 invalid_api_key; marker missing: 503 index_unavailable.
--   5. Admitted: X-Api-Key-Id and X-Api-Key-Consumer to the backend, the key
--      headers removed, rate-limit headers on the response.
--   Before anything else, the per-IP ceiling's client headers are cleared
--   (see CEILING_HEADERS), so clients only see the key's rate-limit headers.
--   More than 1000 request headers: 400 (a key value could hide past the
--   limit). The key headers are removed from what logging plugins serialize.
--
-- Fails closed: any Redis error is 503 gateway_unavailable. The plugin sets
-- no CORS headers (the global cors plugin handles them). Denials are logged
-- sampled (per worker, per error code), with the first 8 hex characters of
-- the key hash and the client IP; never the key.
--
-- PRIORITY 900 (access phase): after rate-limiting (910), which is the per-IP
-- ceiling on partner services, so invalid-key attempts are counted per IP;
-- before request-transformer (801), which adds X-Kong-Trust. It does not call
-- kong.client.authenticate (keys have no Kong consumer entity). The bundled
-- response-ratelimiting plugin also has priority 900 (order between the two
-- is undefined); the framework never configures it.

local cjson = require "cjson.safe"
local sha256_hex = require("kong.tools.sha256").sha256_hex
local redis = require "kong.plugins.tsdevstack-api-key.redis"
local script = require "kong.plugins.tsdevstack-api-key.script"
local windows = require "kong.plugins.tsdevstack-api-key.windows"

local kong = kong
local ngx = ngx
local type = type
local max = math.max
local tostring = tostring
local fmt = string.format

local INDEX_MARKER_KEY = "apikey:meta"
local ID_HEADER = "X-Api-Key-Id"
local CONSUMER_HEADER = "X-Api-Key-Consumer"
local MAX_REQUEST_HEADERS = 1000
local UNAVAILABLE_RETRY_AFTER = 5
local DENIAL_LOG_INTERVAL = 10
local LAST_USED_KEY = "lu"
local RECORD_KEY = "rec"
local WWW_AUTHENTICATE = 'Key realm="tsdevstack"'

local WINDOW_TITLES = { "Minute", "Hour", "Day", "Week", "Month" }

-- Response headers the per-IP ceiling (service-scoped rate-limiting, minute
-- window) sets in its access phase. It must show them: on kong 3.8.0
-- hide_client_headers = true turns its 429 into a 500. The bundled plugin
-- writes them to ngx.header (kong/pdk/private/rate_limiting.lua), which
-- kong.response.clear_header removes; they are cleared here before this
-- plugin sets its own or denies. The ceiling's own 429 never reaches this
-- plugin and keeps them.
local CEILING_HEADERS = {
  "X-RateLimit-Limit-Minute",
  "X-RateLimit-Remaining-Minute",
  "RateLimit-Limit",
  "RateLimit-Remaining",
  "RateLimit-Reset",
  "Retry-After",
}
local QUOTA_WINDOWS = { week = true, month = true }

local ERRORS = {
  api_key_missing = { 401, "An API key is required" },
  invalid_api_key = { 401, "Invalid API key" },
  api_key_revoked = { 401, "API key revoked" },
  api_key_expired = { 401, "API key expired" },
  rate_limit_exceeded = { 429, "API rate limit exceeded" },
  quota_exceeded = { 429, "API quota exceeded" },
  index_unavailable = { 503, "API key index unavailable, retry later" },
  gateway_unavailable = { 503, "API key validation unavailable, retry later" },
}

-- Sampled denial logging, per worker: at most one line per error code every
-- DENIAL_LOG_INTERVAL seconds, with the number of lines suppressed since.
local last_logged = {}
local suppressed = {}

local function log_denial(code, key_hash, detail)
  local now = ngx.now()
  local last = last_logged[code]
  if last and now - last < DENIAL_LOG_INTERVAL then
    suppressed[code] = (suppressed[code] or 0) + 1
    return
  end
  local skipped = suppressed[code] or 0
  last_logged[code] = now
  suppressed[code] = 0

  local log = ERRORS[code][1] == 503 and kong.log.err or kong.log.notice
  log("denied ", code,
      " key=", key_hash and key_hash:sub(1, 8) or "-",
      " ip=", tostring(kong.client.get_forwarded_ip()),
      detail and (" " .. detail) or "",
      skipped > 0 and (" (" .. fmt("%d", skipped) .. " similar denials not logged)") or "")
end

local function deny(code, key_hash, detail, headers)
  log_denial(code, key_hash, detail)
  local status, message = ERRORS[code][1], ERRORS[code][2]
  if status == 503 then
    headers = headers or {}
    headers["Retry-After"] = fmt("%d", UNAVAILABLE_RETRY_AFTER)
  elseif status == 401 then
    -- Same format as the bundled key-auth plugin (Key realm="<realm>")
    headers = headers or {}
    headers["WWW-Authenticate"] = WWW_AUTHENTICATE
  end
  return kong.response.exit(status, { error = code, message = message }, headers)
end

-- Configured key header names, lowercased and without duplicates (the
-- schema already rejects case-insensitive duplicates)
local function normalize_key_names(key_names)
  local names, seen = {}, {}
  for i = 1, #key_names do
    local name = key_names[i]:lower()
    if not seen[name] then
      seen[name] = true
      names[#names + 1] = name
    end
  end
  return names
end

-- Exactly one non-empty value across all key headers, else nil
local function read_key(headers, names)
  local found
  for i = 1, #names do
    local value = headers[names[i]]
    if value ~= nil then
      if found ~= nil or type(value) ~= "string" then
        return nil
      end
      found = value
    end
  end
  if found == "" then
    return nil
  end
  return found
end

-- RateLimit-* and X-RateLimit-*-{Window} for every limited window.
-- RateLimit-* describe the window with the fewest remaining requests (ties go
-- to the longer window), like the bundled rate-limiting plugin.
local function rate_limit_headers(result, current, now, headers)
  local chosen_limit, chosen_remaining, chosen_reset
  for i = 1, #WINDOW_TITLES do
    local limit = tonumber(result.limits[i]) or 0
    if limit > 0 then
      local remaining = max(0, limit - (tonumber(result.counts[i]) or 0))
      headers["X-RateLimit-Limit-" .. WINDOW_TITLES[i]] = fmt("%d", limit)
      headers["X-RateLimit-Remaining-" .. WINDOW_TITLES[i]] = fmt("%d", remaining)
      if not chosen_remaining or remaining <= chosen_remaining then
        chosen_limit = limit
        chosen_remaining = remaining
        chosen_reset = max(1, current[i].ends - now)
      end
    end
  end
  if chosen_limit then
    headers["RateLimit-Limit"] = fmt("%d", chosen_limit)
    headers["RateLimit-Remaining"] = fmt("%d", chosen_remaining)
    headers["RateLimit-Reset"] = fmt("%d", chosen_reset)
  end
  return headers
end

local ApiKeyHandler = {
  PRIORITY = 900,
  VERSION = "1.0.0",
}

function ApiKeyHandler:access(conf)
  for i = 1, #CEILING_HEADERS do
    kong.response.clear_header(CEILING_HEADERS[i])
  end

  local names = normalize_key_names(conf.key_names)

  -- Logging plugins never serialize the raw key
  for i = 1, #names do
    kong.log.set_serialize_value("request.headers." .. names[i], nil)
  end

  local headers, headers_err = kong.request.get_headers(MAX_REQUEST_HEADERS)
  if headers_err == "truncated" then
    -- Past the limit a second key value could hide; nothing can be verified
    return kong.response.exit(400, {
      error = "too_many_headers",
      message = "Too many request headers",
    })
  end

  local key = read_key(headers, names)
  if not key then
    return deny("api_key_missing")
  end

  local key_hash, hash_err = sha256_hex(key)
  if not key_hash then
    return deny("gateway_unavailable", nil, "sha256 failed: " .. tostring(hash_err))
  end

  local now = ngx.time()
  local current = windows.compute(now)
  local prefix = "apikey:{" .. key_hash .. "}:"

  local keys = { prefix .. RECORD_KEY }
  local args = { now }
  local defaults = conf.default_limits or {}
  for i = 1, #current do
    local window = current[i]
    keys[i + 1] = prefix .. window.segment .. ":" .. window.id
    args[i + 1] = window.expire_at
    local default = defaults[window.name]
    args[i + 6] = (type(default) == "number" and default > 0) and default or 0
  end
  keys[#keys + 1] = prefix .. LAST_USED_KEY

  local red, connect_err = redis.connect(conf.redis)
  if not red then
    return deny("gateway_unavailable", key_hash, "redis: " .. connect_err)
  end

  local reply, script_err = redis.run_script(red, script, keys, args)
  if not reply then
    redis.discard(red)
    return deny("gateway_unavailable", key_hash, "redis script: " .. script_err)
  end

  local result = type(reply) == "string" and cjson.decode(reply)
  if type(result) ~= "table" then
    redis.release(red)
    return deny("gateway_unavailable", key_hash, "unexpected script reply")
  end

  local status = result.status

  if status == "missing" then
    local marker, marker_err = redis.get(red, INDEX_MARKER_KEY)
    if marker == false then
      redis.discard(red)
      return deny("gateway_unavailable", key_hash, "redis marker: " .. marker_err)
    end
    redis.release(red)
    if marker == nil then
      return deny("index_unavailable", key_hash)
    end
    return deny("invalid_api_key", key_hash)
  end

  redis.release(red)

  if status == "ok" then
    kong.service.request.set_header(ID_HEADER, result.id)
    kong.service.request.set_header(CONSUMER_HEADER, result.consumer)
    for i = 1, #names do
      kong.service.request.clear_header(names[i])
    end
    local headers = rate_limit_headers(result, current, now, {})
    for name, value in pairs(headers) do
      kong.response.set_header(name, value)
    end
    return
  end

  if status == "limited" then
    -- The exceeded window that resets last decides the code and Retry-After
    local retry_after, exceeded
    for i = 1, #current do
      local limit = tonumber(result.limits[i]) or 0
      if limit > 0 and (tonumber(result.counts[i]) or 0) >= limit then
        local wait = max(1, current[i].ends - now)
        if not retry_after or wait >= retry_after then
          retry_after = wait
          exceeded = current[i].name
        end
      end
    end
    local headers = rate_limit_headers(result, current, now, {})
    headers["Retry-After"] = fmt("%d", retry_after)
    local code = QUOTA_WINDOWS[exceeded] and "quota_exceeded" or "rate_limit_exceeded"
    return deny(code, key_hash, "window=" .. tostring(exceeded), headers)
  end

  if status == "revoked" then
    return deny("api_key_revoked", key_hash)
  end
  if status == "expired" then
    return deny("api_key_expired", key_hash)
  end
  if status == "unsupported_version" then
    return deny("gateway_unavailable", key_hash,
      "record version " .. (type(result.v) == "number" and fmt("%d", result.v) or tostring(result.v)) .. " is not supported by this plugin version; update the CLI and rebuild Kong")
  end
  if status == "malformed" then
    return deny("gateway_unavailable", key_hash, "malformed record: " .. tostring(result.reason))
  end

  return deny("gateway_unavailable", key_hash, "unexpected script status " .. tostring(status))
end

return ApiKeyHandler
