-- tsdevstack-api-prefix (framework plugin, set on each partner service).
--
-- Partner routes match the full public path (/api/{globalPrefix}/...) with an
-- anchored regex and strip_path false. Backends serve the path without the
-- public prefix, so this plugin removes it from the upstream path.
--
-- kong.request.get_path() is the normalized path the router matched (dot
-- segments resolved, duplicate slashes merged); percent-encoded reserved
-- characters such as %2F stay encoded. set_path only changes the path: the
-- query string is kept.
--
-- PRIORITY 940 (access phase): after oidc (1000) and acl (950), before the
-- per-IP rate-limiting ceiling (910) and tsdevstack-api-key (900). Rewriting
-- before the key check is harmless: only the upstream path changes, and a
-- denied request never reaches the upstream. Not used by any bundled plugin.
-- A request-transformer replace.uri (801) runs later and would override the
-- path.

local ApiPrefixHandler = {
  PRIORITY = 940,
  VERSION = "1.0.0",
}

function ApiPrefixHandler:access(conf)
  local prefix = conf.prefix
  local path = kong.request.get_path()

  if path:sub(1, #prefix + 1) == prefix .. "/" then
    kong.service.request.set_path(path:sub(#prefix + 1))
  end
end

return ApiPrefixHandler
