-- tsdevstack-opentelemetry config: the fields of Kong's bundled
-- OpenTelemetry plugin, under this plugin's name, plus one setting:
--
-- traceparent_copy_header (optional, off when not set): a header that
-- carries a copy of the W3C traceparent, for platforms that rewrite
-- traceparent on the way (Cloud Run points it at its own span, with its own
-- sampling decision). A request's copy is what Kong continues, and the
-- traceparent Kong sends upstream is copied into it.
--
-- Kong copies a schema when it loads it (db/schema/init.lua Schema.new), so
-- sharing the field definitions with the bundled plugin is safe. The config
-- record and its field list are copied here before the setting is added, so
-- the bundled plugin's own tables never change.

local typedefs = require "kong.db.schema.typedefs"
local base = require "kong.plugins.opentelemetry.schema"

local schema = {}
for key, value in pairs(base) do
  schema[key] = value
end
schema.name = "tsdevstack-opentelemetry"

local fields = {}
for i, field in ipairs(base.fields) do
  if field.config then
    local config = {}
    for key, value in pairs(field.config) do
      config[key] = value
    end
    local config_fields = {}
    for j, config_field in ipairs(field.config.fields) do
      config_fields[j] = config_field
    end
    config_fields[#config_fields + 1] = {
      traceparent_copy_header = typedefs.header_name,
    }
    config.fields = config_fields
    fields[i] = { config = config }
  else
    fields[i] = field
  end
end
schema.fields = fields

return schema
