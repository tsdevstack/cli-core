-- tsdevstack-trust (framework plugin, generated as a global plugin).
--
-- Backends accept a request only when the trust header (X-Kong-Trust)
-- carries the trust token (secret KONG_TRUST_TOKEN): proof that it came
-- through Kong. This plugin sets it on every request Kong passes to a
-- backend. tsdevstack-strip-identity removes a client-sent value first
-- (priority 50000).
--
-- The token is a reference ({vault://env/kong-trust-token}) that Kong
-- resolves from its environment when it starts, so the Kong image never
-- holds it.
--
-- PRIORITY 10 (access phase): after every bundled plugin that edits request
-- headers (request-transformer 801), so none of them can remove it.

local TrustHandler = {
  PRIORITY = 10,
  VERSION = "1.0.0",
}

function TrustHandler:access(conf)
  kong.service.request.set_header(conf.header, conf.token)
end

return TrustHandler
