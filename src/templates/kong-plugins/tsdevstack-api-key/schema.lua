local typedefs = require "kong.db.schema.typedefs"
local redis_schema = require "kong.tools.redis.schema"

-- Header names are case-insensitive: the same name twice is a config error
local function unique_key_names(names)
  local seen = {}
  for i = 1, #names do
    local name = names[i]:lower()
    if seen[name] then
      return nil, "duplicate key name (header names are case-insensitive): " .. names[i]
    end
    seen[name] = true
  end
  return true
end

local function limit(window)
  return {
    description = "Requests per " .. window .. " for keys without their own " .. window .. " limit.",
    type = "integer",
    between = { 1, 2147483647 },
    required = false,
  }
end

return {
  name = "tsdevstack-api-key",
  fields = {
    { consumer = typedefs.no_consumer },
    { protocols = typedefs.protocols_http },
    { config = {
        type = "record",
        fields = {
          { key_names = {
              description = "Request headers the API key is read from. Exactly one value must be present.",
              type = "array",
              required = true,
              len_min = 1,
              elements = typedefs.header_name,
              default = { "x-api-key" },
              custom_validator = unique_key_names,
            },
          },
          -- Same shape as the bundled rate-limiting plugin (placeholders and
          -- the CLI's Redis TLS patcher apply to it).
          { redis = redis_schema.config_schema },
          { default_limits = {
              description = "Per-window limits for keys whose record has no limit for that window (the global rate-limiting values).",
              type = "record",
              required = true,
              fields = {
                { minute = limit("minute") },
                { hour = limit("hour") },
                { day = limit("day") },
                { week = limit("week") },
                { month = limit("month") },
              },
            },
          },
        },
      },
    },
  },
  entity_checks = {
    { at_least_one_of = { "config.redis.host" } },
  },
}
