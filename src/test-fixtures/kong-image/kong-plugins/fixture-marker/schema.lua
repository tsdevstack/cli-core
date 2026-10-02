local typedefs = require "kong.db.schema.typedefs"

return {
  name = "fixture-marker",
  fields = {
    { protocols = typedefs.protocols_http },
    { config = {
        type = "record",
        fields = {
          { message = { type = "string", default = "loaded" } },
        },
      },
    },
  },
}
