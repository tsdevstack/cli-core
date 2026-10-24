-- tsdevstack-client-ip (framework plugin, generated as a global plugin).
--
-- The Next.js frontend calls Kong from its server for its visitors (login,
-- signup, token refresh, ...), so those calls arrive from the frontend
-- server's address and the global rate-limiting would count every visitor
-- as one client. The frontend sends the visitor's address in client_ip_header
-- and the frontend token (secret KONG_FRONTEND_TOKEN) in token_header. When
-- the token matches and no auth plugin has set a consumer or credential, this
-- plugin sets a credential named after the visitor's address. The global
-- rate-limiting (limit_by "consumer", Kong's default: consumer, else
-- credential, else client IP) then counts that visitor. A logged-in request
-- keeps the credential the OIDC plugin set (the user), and a request without
-- the token, or with a wrong one, keeps its own address. Both headers are
-- removed from every request before it reaches a backend.
--
-- Backends rate-limit per IP too, and cannot use X-Real-IP for it: Kong sets
-- that to the frontend server's address (proxy_set_header X-Real-IP
-- $remote_addr). So every request gets real_ip_header with the address the
-- backend should count: the visitor a trusted frontend named, otherwise the
-- address Kong resolved. tsdevstack-strip-identity removes a client-sent
-- value of it first (priority 50000).
--
-- PRIORITY 950 (access phase): after the auth plugins (oidc 1000, key-auth
-- 1250, jwt 1450), so their credential wins; before rate-limiting (910),
-- which reads the credential.

local bit = require "bit"

local byte = string.byte
local find = string.find
local bor = bit.bor
local bxor = bit.bxor

-- Longest textual IPv6 address with an embedded IPv4 one
local MAX_IP_LENGTH = 45

local ClientIpHandler = {
  PRIORITY = 950,
  VERSION = "1.0.0",
}

-- Compares in time that depends on the length only, not on where the values
-- first differ
local function equals(a, b)
  if #a ~= #b then
    return false
  end
  local diff = 0
  for i = 1, #a do
    diff = bor(diff, bxor(byte(a, i), byte(b, i)))
  end
  return diff == 0
end

-- An IPv4 or IPv6 address: the value becomes a rate-limit key, so anything
-- else is ignored
local function is_ip(value)
  return #value <= MAX_IP_LENGTH
    and find(value, "^[%x:.]+$") ~= nil
    and (find(value, ".", 1, true) ~= nil or find(value, ":", 1, true) ~= nil)
end

-- The visitor's address when a trusted frontend named one, else nil
local function trusted_visitor(conf)
  local token = kong.request.get_header(conf.token_header)
  local client_ip = kong.request.get_header(conf.client_ip_header)
  if type(token) ~= "string" or type(client_ip) ~= "string" then
    return nil
  end
  if not equals(token, conf.frontend_token) or not is_ip(client_ip) then
    return nil
  end
  return client_ip
end

function ClientIpHandler:access(conf)
  local visitor = trusted_visitor(conf)

  kong.service.request.clear_header(conf.token_header)
  kong.service.request.clear_header(conf.client_ip_header)
  kong.service.request.set_header(
    conf.real_ip_header,
    visitor or kong.client.get_forwarded_ip()
  )

  if visitor
    and not kong.client.get_consumer()
    and not kong.client.get_credential()
  then
    kong.client.authenticate(nil, { id = "ip:" .. visitor })
  end
end

return ClientIpHandler
