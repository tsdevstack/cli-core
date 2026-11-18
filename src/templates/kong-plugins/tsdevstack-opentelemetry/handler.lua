-- tsdevstack-opentelemetry (framework plugin, generated as a global plugin).
--
-- Kong's bundled OpenTelemetry plugin with parent-based sampling: a trace
-- the caller already sampled is kept. Kong 3.9's plugin follows a parent
-- that was not sampled, but checks a sampled one against its own
-- sampling_rate again (pdk/tracing.lua get_sampling_decision), so below a
-- rate of 1 most traces the frontend kept would lose their Kong and service
-- spans. The setting for this (sampling_strategy) is only in Kong's
-- Enterprise versions.
--
-- Every phase is Kong's plugin, unchanged, with this plugin's config (the
-- same fields, see schema.lua). One difference, in access: when the request's
-- W3C traceparent is valid and sampled, Kong's plugin gets sampling_rate 1
-- for that request, so it keeps the trace. A parent that was not sampled is
-- dropped by Kong itself; a request without a parent is sampled at the
-- configured rate.
--
-- Only the frontend's trace headers get here: tsdevstack-client-ip
-- (priority 950, same phase) removes them from every request without the
-- frontend token, so outside clients cannot force sampling.
--
-- With traceparent_copy_header set (off when not set), the trace also
-- travels in that header, for platforms that rewrite traceparent on the way
-- (Cloud Run points it at its own span, with its own sampling decision):
-- a request's copy replaces its traceparent before Kong reads it, and the
-- traceparent Kong sends upstream is copied into it (any other value is
-- replaced, or removed when Kong sends none).

local base = require "kong.plugins.opentelemetry.handler"

local match = string.match
local tonumber = tonumber
local type = type

local TraceHandler = {
  -- Kong's plugin's place in the plugin order (14)
  PRIORITY = base.PRIORITY,
  VERSION = "1.0.0",
}

-- Every handler of Kong's plugin (configure, access, header_filter, log),
-- called with this plugin's config
for name, handler in pairs(base) do
  if type(handler) == "function" then
    TraceHandler[name] = function(_, ...)
      return handler(base, ...)
    end
  end
end

local base_access = base.access

-- A copy of each config with sampling_rate 1, made once per config
local follow_parent_confs = setmetatable({}, { __mode = "k" })

local function follow_parent_conf(conf)
  local copy = follow_parent_confs[conf]
  if not copy then
    copy = {}
    for key, value in pairs(conf) do
      copy[key] = value
    end
    copy.sampling_rate = 1
    follow_parent_confs[conf] = copy
  end
  return copy
end

-- Whether the request's traceparent is valid and sampled, by the rules of
-- Kong's own W3C reader (observability/tracing/propagation/extractors/w3c.lua):
-- version 00, non-zero 32-digit trace ID and 16-digit parent ID, 2-digit
-- flags. A repeated header is a table there, and is ignored the same way.
local function parent_sampled()
  local traceparent = kong.request.get_headers()["traceparent"]
  if type(traceparent) ~= "string" then
    return false
  end

  local version, trace_id, parent_id, flags =
    match(traceparent, "^(%x+)%-(%x+)%-(%x+)%-(%x+)$")
  if version ~= "00"
    or #trace_id ~= 32 or tonumber(trace_id, 16) == 0
    or #parent_id ~= 16 or tonumber(parent_id, 16) == 0
    or #flags ~= 2
  then
    return false
  end

  return tonumber(flags, 16) % 2 == 1
end

-- The caller's copy of its traceparent, when it sent one, is the trace
-- Kong continues. A repeated header is a table and is ignored.
local function restore_traceparent(copy_header)
  local copy = kong.request.get_headers()[copy_header]
  if type(copy) == "string" then
    kong.service.request.set_header("traceparent", copy)
  end
end

-- The traceparent Kong's plugin set for the upstream request, copied (the
-- request headers include what plugins set for the upstream request)
local function copy_traceparent(copy_header)
  local traceparent = kong.request.get_headers()["traceparent"]
  if type(traceparent) == "string" then
    kong.service.request.set_header(copy_header, traceparent)
  else
    kong.service.request.clear_header(copy_header)
  end
end

function TraceHandler:access(conf)
  local copy_header = conf.traceparent_copy_header
  if copy_header then
    restore_traceparent(copy_header)
  end

  if parent_sampled() then
    base_access(base, follow_parent_conf(conf))
  else
    base_access(base, conf)
  end

  if copy_header then
    copy_traceparent(copy_header)
  end
end

return TraceHandler
