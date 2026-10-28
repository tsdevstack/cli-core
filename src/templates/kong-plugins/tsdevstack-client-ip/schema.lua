local typedefs = require "kong.db.schema.typedefs"

-- Header defaults: keep in sync with KONG_CLIENT_IP_HEADER,
-- KONG_FRONTEND_TOKEN_HEADER and KONG_UPSTREAM_CLIENT_IP_HEADER in the CLI
-- (constants/kong.ts); a test compares them. The generator sets every field.
-- frontend_token is referenceable: the config holds
-- {vault://env/kong-frontend-token}, resolved from Kong's environment when
-- Kong starts.
return {
  name = "tsdevstack-client-ip",
  fields = {
    { consumer = typedefs.no_consumer },
    { protocols = typedefs.protocols_http },
    {
      config = {
        type = "record",
        fields = {
          { frontend_token = { type = "string", required = true, referenceable = true } },
          { client_ip_header = { type = "string", required = true, default = "X-Tsdevstack-Client-IP" } },
          { token_header = { type = "string", required = true, default = "X-Tsdevstack-Frontend-Token" } },
          { real_ip_header = { type = "string", required = true, default = "X-Tsdevstack-Real-IP" } },
        },
      },
    },
  },
}
