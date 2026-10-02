local typedefs = require "kong.db.schema.typedefs"

return {
  name = "tsdevstack-api-prefix",
  fields = {
    { consumer = typedefs.no_consumer },
    { protocols = typedefs.protocols_http },
    { config = {
        type = "record",
        fields = {
          { prefix = {
              description = "Public path prefix removed from the upstream path (one segment, for example /api).",
              type = "string",
              required = true,
              default = "/api",
              match = "^/[%w%-_]+$",
            },
          },
        },
      },
    },
  },
}
