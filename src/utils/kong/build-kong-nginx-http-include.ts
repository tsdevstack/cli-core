/**
 * Build the Dockerfile snippet that adds the framework's nginx http {} directives
 */

import {
  KONG_ACCESS_LOG_CONDITION_VARIABLE,
  KONG_AWS_PROBE_PATH,
  KONG_AZURE_PROBE_PATH,
  KONG_NGINX_HTTP_INCLUDE_FILE,
  KONG_OIDC_SHARED_DICTS,
} from '../../constants';

/**
 * Returns the Dockerfile steps that write KONG_NGINX_HTTP_INCLUDE_FILE and
 * point KONG_NGINX_HTTP_INCLUDE at it, so Kong renders `include <file>;`
 * into its http {} block. The file holds:
 *
 * - one `lua_shared_dict` per KONG_OIDC_SHARED_DICTS zone;
 * - the map that sets KONG_ACCESS_LOG_CONDITION_VARIABLE, which the proxy
 *   access log reads (KONG_PROXY_ACCESS_LOG in the Dockerfile): 0 for a
 *   load balancer probe answered 200, 1 for everything else. Any other
 *   answer to a probe path is still logged.
 *
 * Other injected nginx directives (KONG_NGINX_HTTP_*, including
 * KONG_NGINX_HTTP_LUA_SHARED_DICT) stay free. Setting KONG_NGINX_HTTP_INCLUDE
 * at runtime replaces this file: the replacement needs the map too (nginx
 * doesn't start with an access log on an unknown variable), and without
 * the zones the OIDC plugin fetches its documents on every JWT request.
 */
export function buildKongNginxHttpInclude(): string {
  const lines = [
    ...KONG_OIDC_SHARED_DICTS.map(
      (dict) => `lua_shared_dict ${dict.name} ${dict.size};`,
    ),
    `map "$uri:$status" $${KONG_ACCESS_LOG_CONDITION_VARIABLE} {`,
    ...[KONG_AWS_PROBE_PATH, KONG_AZURE_PROBE_PATH].map(
      (path) => `    ${path}:200 0;`,
    ),
    '    default 1;',
    '}',
  ]
    .map((line) => `'${line}'`)
    .join(' ');

  return `# Shared memory caches of lua-resty-openidc (OIDC discovery document and
# JWKS); without them the OIDC plugin fetches both on every JWT request.
# The access log's condition: load balancer probes answered 200 are not logged
RUN printf '%s\\n' ${lines} > ${KONG_NGINX_HTTP_INCLUDE_FILE}
ENV KONG_NGINX_HTTP_INCLUDE=${KONG_NGINX_HTTP_INCLUDE_FILE}
`;
}
