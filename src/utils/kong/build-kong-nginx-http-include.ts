/**
 * Build the Dockerfile snippet that adds the framework's nginx http {} directives
 */

import {
  KONG_NGINX_HTTP_INCLUDE_FILE,
  KONG_OIDC_SHARED_DICTS,
} from '../../constants';

/**
 * Returns the Dockerfile steps that write KONG_NGINX_HTTP_INCLUDE_FILE (one
 * `lua_shared_dict` per KONG_OIDC_SHARED_DICTS zone) and point
 * KONG_NGINX_HTTP_INCLUDE at it, so Kong renders
 * `include <file>;` into its http {} block.
 *
 * Other injected nginx directives (KONG_NGINX_HTTP_*, including
 * KONG_NGINX_HTTP_LUA_SHARED_DICT) stay free. Setting KONG_NGINX_HTTP_INCLUDE
 * at runtime replaces this include and drops the OIDC caches.
 */
export function buildKongNginxHttpInclude(): string {
  const lines = KONG_OIDC_SHARED_DICTS.map(
    (dict) => `'lua_shared_dict ${dict.name} ${dict.size};'`,
  ).join(' ');

  return `# Shared memory caches of lua-resty-openidc (OIDC discovery document and
# JWKS); without them the OIDC plugin fetches both on every JWT request
RUN printf '%s\\n' ${lines} > ${KONG_NGINX_HTTP_INCLUDE_FILE}
ENV KONG_NGINX_HTTP_INCLUDE=${KONG_NGINX_HTTP_INCLUDE_FILE}
`;
}
