/**
 * Build the Dockerfile step that lowers the OIDC plugin's bad-token logs
 */

/** kong-oidc-v3's handler, where the Dockerfile installs it */
const OIDC_HANDLER = '/usr/local/share/lua/5.1/kong/plugins/oidc/handler.lua';

/** lua-resty-openidc, where the Dockerfile installs it */
const RESTY_OPENIDC = '/usr/local/share/lua/5.1/resty/openidc.lua';

/**
 * Returns the Dockerfile step that logs a client's bad token at info instead
 * of error, in the pinned kong-oidc-v3 and lua-resty-openidc files:
 *
 * - kong-oidc-v3 `handler.lua`: "Bearer JWT verify failed" (every rejected
 *   token; Kong answers 401)
 * - lua-resty-openidc: "token expired"
 * - lua-resty-openidc: a key id not in the key set ("RSA key with id ...
 *   not found", a token signed with a key the auth service no longer has)
 *   and a token without a key id. Other key errors on that line (a key set
 *   it can't read) stay at error.
 *
 * Failures on Kong's side keep their own error lines: the discovery document
 * (handler and lua-resty-openidc) and the key set fetch (lua-resty-openidc).
 * Each edit is checked: the build stops if a line is not where it was, so
 * new plugin versions can't drop the change unnoticed.
 */
export function buildOidcLogLevelPatch(): string {
  return `# A client's bad token (expired, signed with a key the auth service no
# longer has, forged) is the client's problem and shows as a 401 in the access
# log: log it at info (below KONG_LOG_LEVEL), not error. Failures on Kong's
# side (discovery document, key set) stay at error. The build stops if a line
# to change is not found.
RUN sed -i "s/kong.log.err('Bearer JWT verify failed: '/kong.log.info('Bearer JWT verify failed: '/" ${OIDC_HANDLER} && \\
    grep -qF "kong.log.info('Bearer JWT verify failed: '" ${OIDC_HANDLER} && \\
    sed -i 's/log(ERROR, "token expired: json.exp="/log(ngx.INFO, "token expired: json.exp="/' ${RESTY_OPENIDC} && \\
    grep -qF 'log(ngx.INFO, "token expired: json.exp="' ${RESTY_OPENIDC} && \\
    sed -i '/secret, err = openidc_pem_from_jwk(opts, jwt_obj.header.kid)/,/return nil, err/ s/log(ERROR, err)/log((err:find("^RSA key with id ") or err:find("^JWT doesn")) and ngx.INFO or ERROR, err)/' ${RESTY_OPENIDC} && \\
    grep -qF 'err:find("^RSA key with id ")' ${RESTY_OPENIDC}
`;
}
