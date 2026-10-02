-- tsdevstack-api-key: Redis connection and script calls (lua-resty-redis).
--
-- Connection handling follows Kong's bundled rate-limiting plugin
-- (kong/plugins/rate-limiting/policies/init.lua): TLS options on connect,
-- AUTH (with username for ACL users) and SELECT only on a fresh connection,
-- vault references resolved through kong.vault.try, keepalive 10 s / 100.
-- Differences: the pool name is always our own and includes the TLS and
-- credential settings, so connections are never shared with rate-limiting
-- (whose pool name is only host:port); and a failed call closes the socket
-- instead of returning it to the pool.
--
-- resty.redis does not follow MOVED: Redis must be a single endpoint
-- (standalone, primary endpoint, or a proxying cluster endpoint).

local redis = require "resty.redis"

local null = ngx.null
local tostring = tostring
local unpack = unpack
local concat = table.concat

local POOL_PREFIX = "tsdevstack-api-key"
local KEEPALIVE_IDLE_MS = 10000
local KEEPALIVE_POOL_SIZE = 100

local _M = {}

local function is_present(value)
  return value ~= nil and value ~= null and value ~= ""
end

local function pool_name(conf)
  return concat({
    POOL_PREFIX,
    tostring(conf.host),
    tostring(conf.port),
    tostring(conf.database or 0),
    conf.ssl and "tls" or "plain",
    conf.ssl_verify and "verify" or "noverify",
    is_present(conf.server_name) and conf.server_name or "",
    is_present(conf.username) and conf.username or "",
  }, ":")
end

-- Opens (or reuses) a connection. Returns the client, or nil and an error.
function _M.connect(conf)
  local red = redis:new()
  red:set_timeout(conf.timeout)

  local ok, err = red:connect(conf.host, conf.port, {
    ssl = conf.ssl,
    ssl_verify = conf.ssl_verify,
    server_name = is_present(conf.server_name) and conf.server_name or nil,
    pool = pool_name(conf),
  })
  if not ok then
    return nil, "connect failed: " .. tostring(err)
  end

  local times, reused_err = red:get_reused_times()
  if not times then
    red:close()
    return nil, "connection state unknown: " .. tostring(reused_err)
  end

  if times == 0 then
    if is_present(conf.password) then
      local auth_ok, auth_err
      if is_present(conf.username) then
        auth_ok, auth_err = kong.vault.try(function(cfg)
          return red:auth(cfg.username, cfg.password)
        end, conf)
      else
        auth_ok, auth_err = kong.vault.try(function(cfg)
          return red:auth(cfg.password)
        end, conf)
      end
      if not auth_ok then
        red:close()
        return nil, "AUTH failed: " .. tostring(auth_err)
      end
    end

    if conf.database and conf.database ~= 0 then
      local select_ok, select_err = red:select(conf.database)
      if not select_ok then
        red:close()
        return nil, "SELECT failed: " .. tostring(select_err)
      end
    end
  end

  return red
end

-- Returns a healthy connection to the pool.
function _M.release(red)
  local ok, err = red:set_keepalive(KEEPALIVE_IDLE_MS, KEEPALIVE_POOL_SIZE)
  if not ok then
    kong.log.warn("failed to set Redis keepalive: ", err)
  end
end

-- Closes a connection after a failed call (its state is unknown).
function _M.discard(red)
  red:close()
end

-- Runs the script with EVALSHA; when Redis lost its script cache (NOSCRIPT,
-- after a restart or failover) runs it once with EVAL, which also caches it
-- again. Returns the reply, or nil and an error.
function _M.run_script(red, script, keys, args)
  local argv = { #keys }
  for i = 1, #keys do
    argv[#argv + 1] = keys[i]
  end
  for i = 1, #args do
    argv[#argv + 1] = args[i]
  end

  local res, err = red:evalsha(script.sha1, unpack(argv))
  if res == false and err and err:find("^NOSCRIPT") then
    res, err = red:eval(script.source, unpack(argv))
  end

  if res == nil or res == false then
    return nil, tostring(err)
  end
  return res
end

-- GET of a single key; returns the value (nil when absent), or false and
-- an error.
function _M.get(red, key)
  local res, err = red:get(key)
  if res == nil or res == false then
    return false, tostring(err)
  end
  if res == null then
    return nil
  end
  return res
end

return _M
