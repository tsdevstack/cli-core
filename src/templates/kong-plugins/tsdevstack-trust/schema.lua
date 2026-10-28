local typedefs = require "kong.db.schema.typedefs"

-- Header default: keep in sync with KONG_TRUST_HEADER in the CLI
-- (constants/kong.ts); a test compares them. The generator sets every field.
-- token is referenceable: the config holds {vault://env/kong-trust-token},
-- resolved from Kong's environment when Kong starts.
return {
  name = "tsdevstack-trust",
  fields = {
    { consumer = typedefs.no_consumer },
    { protocols = typedefs.protocols_http },
    {
      config = {
        type = "record",
        fields = {
          { token = { type = "string", required = true, referenceable = true } },
          { header = { type = "string", required = true, default = "X-Kong-Trust" } },
        },
      },
    },
  },
}
