local typedefs = require "kong.db.schema.typedefs"

return {
  name = "tsdevstack-strip-identity",
  fields = {
    { consumer = typedefs.no_consumer },
    { protocols = typedefs.protocols_http },
    { config = { type = "record", fields = {} } },
  },
}
