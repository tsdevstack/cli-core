-- tsdevstack-api-key: the one Redis script run per request.
--
-- The script reads everything first (record, the five window counters, the
-- last-used time), decides, and only writes when the request is admitted.
-- Denied requests are never counted.
--
-- KEYS (all share the hash tag {<h>}, so one call stays in one slot):
--   1 apikey:{<h>}:rec
--   2 apikey:{<h>}:min:<start>
--   3 apikey:{<h>}:hour:<start>
--   4 apikey:{<h>}:day:<start>
--   5 apikey:{<h>}:week:<start>
--   6 apikey:{<h>}:month:<YYYY-MM>
--   7 apikey:{<h>}:lu
-- ARGV:
--   1       now (epoch seconds, UTC)
--   2 to 6  counter expire-at (epoch seconds) for minute, hour, day, week, month
--   7 to 11 default limit for minute, hour, day, week, month (0 = none)
--
-- Returns one JSON object; `status` is one of:
--   missing              no record (the handler then checks the index marker)
--   unsupported_version  `v` is a number this script does not know (field `v`)
--   malformed            the record breaks the contract (field `reason`)
--   revoked, expired
--   limited              a window is at its limit (fields `limits`, `counts`)
--   ok                   admitted and counted (fields `id`, `consumer`,
--                        `limits`, `counts`)
-- `limits` and `counts` are arrays in window order (minute to month);
-- a limit of 0 means the window is not limited. For `ok`, `counts` are the
-- values after this request; for `limited`, the values before it.
--
-- The Lua source between the SOURCE delimiters is loaded verbatim by the
-- Redis script test suite in the CLI package.

local to_hex = require("resty.string").to_hex

local SOURCE = [==[
local WINDOWS = { "minute", "hour", "day", "week", "month" }
-- Week and month counters are the usage totals the key owner's usage sync
-- copies to its database, so they count every admitted request, limited or
-- not. Minute, hour and day counters only exist while a limit applies.
local ALWAYS_COUNTED = { false, false, false, true, true }
local KNOWN_VERSIONS = { [1] = true }
local LAST_USED_WRITE_INTERVAL = 60
local LAST_USED_TTL = 2592000
local MAX_SAFE_INTEGER = 9007199254740991
-- Limits are capped like the TypeScript validator (2^31 - 1)
local MAX_LIMIT = 2147483647

local function result(value)
  return cjson.encode(value)
end

local function is_positive_integer(value, max)
  return type(value) == "number" and value > 0 and value <= max
    and value == math.floor(value)
end

local function is_identifier(value)
  return type(value) == "string" and #value >= 1 and #value <= 128
    and not string.find(value, "[^A-Za-z0-9._%-]")
end

-- cjson decodes {} and [] to the same empty table, so "limits":[] is
-- accepted like {} (no limits of its own: default_limits apply). A non-empty
-- array has numeric keys and is rejected as an unknown window.
local function check_record(rec)
  if not is_identifier(rec.id) then
    return "id is not a valid identifier"
  end
  if not is_identifier(rec.consumer) then
    return "consumer is not a valid identifier"
  end
  if rec.status ~= "active" and rec.status ~= "revoked" then
    return "status is not active or revoked"
  end
  if type(rec.limits) ~= "table" then
    return "limits is not an object"
  end
  for window, limit in pairs(rec.limits) do
    local known = false
    for i = 1, #WINDOWS do
      if WINDOWS[i] == window then
        known = true
      end
    end
    if not known then
      return "limits has an unknown window"
    end
    if not is_positive_integer(limit, MAX_LIMIT) then
      return "limits." .. window .. " is not a positive integer"
    end
  end
  if rec.expiresAt ~= nil and not is_positive_integer(rec.expiresAt, MAX_SAFE_INTEGER) then
    return "expiresAt is not a positive integer"
  end
  return nil
end

local now = tonumber(ARGV[1])

-- Reads
local raw = redis.call("GET", KEYS[1])
if not raw then
  return result({ status = "missing" })
end

local decoded, rec = pcall(cjson.decode, raw)
if not decoded or type(rec) ~= "table" then
  return result({ status = "malformed", reason = "record is not a JSON object" })
end
if type(rec.v) ~= "number" then
  return result({ status = "malformed", reason = "v is missing or not a number" })
end
if not KNOWN_VERSIONS[rec.v] then
  return result({ status = "unsupported_version", v = rec.v })
end

local problem = check_record(rec)
if problem then
  return result({ status = "malformed", reason = problem })
end

if rec.status == "revoked" then
  return result({ status = "revoked" })
end
if rec.expiresAt ~= nil and now >= rec.expiresAt then
  return result({ status = "expired" })
end

local stored = redis.call("MGET", KEYS[2], KEYS[3], KEYS[4], KEYS[5], KEYS[6])
local last_used_raw = redis.call("GET", KEYS[7])
local last_used = last_used_raw and tonumber(last_used_raw)

local limits = {}
local counts = {}
local limited = false
for i = 1, #WINDOWS do
  local limit = rec.limits[WINDOWS[i]] or tonumber(ARGV[6 + i]) or 0
  local count = tonumber(stored[i]) or 0
  limits[i] = limit
  counts[i] = count
  if limit > 0 and count >= limit then
    limited = true
  end
end

if limited then
  return result({ status = "limited", limits = limits, counts = counts })
end

-- Writes (admitted)
for i = 1, #WINDOWS do
  if limits[i] > 0 or ALWAYS_COUNTED[i] then
    local key = KEYS[1 + i]
    counts[i] = redis.call("INCR", key)
    -- A new counter gets its expiry; an existing one without a TTL is repaired
    if counts[i] == 1 or redis.call("TTL", key) < 0 then
      redis.call("EXPIREAT", key, ARGV[1 + i])
    end
  end
end

if not last_used or now - last_used >= LAST_USED_WRITE_INTERVAL then
  redis.call("SET", KEYS[7], now, "EX", LAST_USED_TTL)
end

return result({
  status = "ok",
  id = rec.id,
  consumer = rec.consumer,
  limits = limits,
  counts = counts,
})
]==]

return {
  source = SOURCE,
  sha1 = to_hex(ngx.sha1_bin(SOURCE)),
}
