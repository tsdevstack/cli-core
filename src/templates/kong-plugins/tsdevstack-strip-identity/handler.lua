-- tsdevstack-strip-identity (framework plugin, generated as a global plugin).
--
-- Clients never have a reason to send identity headers: only Kong sets them,
-- after an auth plugin validated a JWT or an API key. This plugin removes the
-- client-sent values before any auth plugin runs, so the backend only sees
-- values set by Kong.
--
-- PRIORITY 50000 (access phase): above every bundled plugin that
-- authenticates or sets identity headers (session 1900, jwt 1450,
-- key-auth 1250, oidc 1000), below zipkin (100000) and pre-function (1000000).
-- In the access phase global, service and route plugins are ordered together
-- by priority, so this runs before service-level auth plugins.
--
-- Keep HEADERS in sync with KONG_CLIENT_IDENTITY_HEADERS in the CLI
-- (constants/kong.ts); a test compares them.

local HEADERS = {
  "X-Userinfo",
  "X-ID-Token",
  "X-Access-Token",
  "X-Consumer-ID",
  "X-Consumer-Custom-ID",
  "X-Consumer-Username",
  "X-Consumer-Groups",
  "X-Credential-Identifier",
  "X-Anonymous-Consumer",
  "X-Authenticated-Groups",
  "X-Authenticated-Scope",
  "X-Authenticated-UserId",
  "X-Api-Key-Id",
  "X-Api-Key-Consumer",
  "X-Kong-Trust",
}

-- Lowercase names with "-" (the lookup form of HEADERS)
local NORMALIZED = {}
for i = 1, #HEADERS do
  NORMALIZED[HEADERS[i]:lower()] = true
end

-- Upper bound for kong.request.get_headers (the PDK maximum)
local MAX_REQUEST_HEADERS = 1000

local StripIdentityHandler = {
  PRIORITY = 50000,
  VERSION = "1.0.0",
}

function StripIdentityHandler:access(conf)
  local clear_header = kong.service.request.clear_header
  for i = 1, #HEADERS do
    clear_header(HEADERS[i])
  end

  -- Defense in depth: nginx passes header names with "_" through
  -- (underscores_in_headers on), and some frameworks treat X_Userinfo like
  -- X-Userinfo. Clear every client header that equals an identity header
  -- once "_" is read as "-".
  local headers, err = kong.request.get_headers(MAX_REQUEST_HEADERS)
  if err == "truncated" then
    -- Headers past the limit cannot be checked, so the request's identity
    -- headers cannot be trusted
    return kong.response.exit(400, {
      error = "too_many_headers",
      message = "Too many request headers",
    })
  end
  for name in pairs(headers) do
    if name:find("_", 1, true) and NORMALIZED[name:gsub("_", "-"):lower()] then
      clear_header(name)
    end
  end
end

return StripIdentityHandler
