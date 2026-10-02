/**
 * Kong Gateway constants
 */

/**
 * Client ID for Kong OIDC plugin configuration.
 *
 * This must match the 'aud' (audience) claim in JWTs issued by the auth service.
 * NOT a secret - required by kong-oidc-v3 plugin config but not validated by any endpoint.
 * In bearer-only mode, Kong only validates JWT signatures via JWKS, not client credentials.
 */
export const KONG_OIDC_CLIENT_ID = 'kong';

/**
 * Client secret for Kong OIDC plugin configuration.
 *
 * Required by kong-oidc-v3 plugin config but NOT used in bearer-only mode.
 * In bearer-only mode, Kong only validates JWT signatures via JWKS.
 * This is not a security credential and does not need rotation.
 */
export const KONG_OIDC_CLIENT_SECRET = 'kong-secret';

/**
 * Base image of the generated Kong Dockerfile (local and cloud).
 * 3.8.0 is the only 3.8 patch release on Docker Hub.
 */
export const KONG_BASE_IMAGE = 'kong:3.8.0';

/**
 * lua-resty-openidc tag installed into the Kong image (dependency of kong-oidc-v3).
 */
export const LUA_RESTY_OPENIDC_VERSION = 'v1.7.6';

/**
 * kong-oidc-v3 commit installed into the Kong image (pinned for reproducible builds).
 */
export const KONG_OIDC_V3_COMMIT = '5c5397ac1ea2848401d73758244ba626afb04a17';

/**
 * Name of the OIDC plugin installed into the Kong image (kong-oidc-v3).
 */
export const KONG_OIDC_PLUGIN_NAME = 'oidc';

/**
 * Plugins bundled with the kong:3.8.0 image (`plugins` list in
 * kong/constants.lua). Enabled through `bundled` in KONG_PLUGINS; a custom
 * plugin with one of these names would shadow the bundled one.
 */
export const KONG_BUNDLED_PLUGINS = [
  'jwt',
  'acl',
  'correlation-id',
  'cors',
  'oauth2',
  'tcp-log',
  'udp-log',
  'file-log',
  'http-log',
  'key-auth',
  'hmac-auth',
  'basic-auth',
  'ip-restriction',
  'request-transformer',
  'response-transformer',
  'request-size-limiting',
  'rate-limiting',
  'response-ratelimiting',
  'syslog',
  'loggly',
  'datadog',
  'ldap-auth',
  'statsd',
  'bot-detection',
  'aws-lambda',
  'request-termination',
  'prometheus',
  'proxy-cache',
  'session',
  'acme',
  'grpc-gateway',
  'grpc-web',
  'pre-function',
  'post-function',
  'azure-functions',
  'zipkin',
  'opentelemetry',
  'ai-proxy',
  'ai-prompt-decorator',
  'ai-prompt-template',
  'ai-prompt-guard',
  'ai-request-transformer',
  'ai-response-transformer',
  'standard-webhooks',
] as const;

/**
 * Folder of custom Kong plugins: user-owned at the project root, and the
 * staged copy (framework + user plugins) inside a Kong build context.
 * Each subfolder is one plugin; its name is the plugin name.
 */
export const KONG_PLUGINS_DIR = 'kong-plugins';

/**
 * Folder inside a Kong build context copied to /kong/declarative/ in the image.
 * Cloud builds put the resolved kong.yml in it; local builds leave it empty
 * (the config is mounted at runtime).
 */
export const KONG_DECLARATIVE_DIR = 'declarative';

/**
 * Local Kong build context, relative to the project root
 * (docker-compose builds the gateway image from here).
 */
export const KONG_LOCAL_BUILD_CONTEXT = 'infrastructure/kong';

/**
 * Framework Kong plugin sources, relative to the CLI templates directory.
 */
export const KONG_FRAMEWORK_PLUGINS_TEMPLATE_DIR = 'kong-plugins';

/**
 * KONG_PLUGINS keyword that enables every bundled plugin.
 */
export const KONG_PLUGINS_BUNDLED_KEYWORD = 'bundled';

/**
 * Valid custom Kong plugin folder name (becomes a KONG_PLUGINS entry and a
 * Lua module path segment): lowercase alphanumeric words joined by - or _.
 */
export const KONG_PLUGIN_NAME_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;

/**
 * Files every custom Kong plugin folder must contain.
 */
export const KONG_PLUGIN_REQUIRED_FILES = [
  'handler.lua',
  'schema.lua',
] as const;

/**
 * Proxy request body limit for local development. Kong 3.8.0's own default
 * (`nginx_http_client_max_body_size = 0` in kong/templates/kong_defaults.lua,
 * unlimited). The generated image bakes the cloud value (maxUploadSize from
 * infrastructure.json, default 10m); docker-compose restores Kong's default.
 */
export const KONG_LOCAL_CLIENT_MAX_BODY_SIZE = '0';

/**
 * nginx shared memory zones lua-resty-openidc caches in (`ngx.shared[name]`
 * in resty/openidc.lua). Without a zone its cache get and set do nothing, and
 * the OIDC plugin fetches the discovery document and the JWKS from the auth
 * service on every JWT-protected request.
 *
 * - discovery: one discovery document per discovery URL (a few kB each)
 * - jwks: the JWKS per jwks_uri plus one PEM per key id (a few kB in all)
 *
 * Entries expire after 24 hours (kong-oidc-v3 sets no expiry option); a token
 * with an unknown key id refetches the JWKS, so key rotation is picked up.
 * Sizes are the lua-resty-openidc README's; 1m holds hundreds of entries and
 * is shared by all nginx workers. The library's other zones are not declared:
 * `introspection` is unused (no introspection endpoint) and `jwt_verification`
 * would cache per-token verification results.
 */
export const KONG_OIDC_SHARED_DICTS = [
  { name: 'discovery', size: '1m' },
  { name: 'jwks', size: '1m' },
] as const;

/**
 * nginx config file in the Kong image with the framework's http {}
 * directives (the KONG_OIDC_SHARED_DICTS zones). Kong includes it in its
 * http {} block through KONG_NGINX_HTTP_INCLUDE (an injected nginx directive
 * takes one value per name, so two lua_shared_dict lines need a file).
 */
export const KONG_NGINX_HTTP_INCLUDE_FILE =
  '/etc/kong/tsdevstack-nginx-http.conf';

/**
 * First line of the generated Kong Dockerfile and .dockerignore. A local
 * Dockerfile without it was hand-written (before it became generated).
 */
export const KONG_GENERATED_FILE_HEADER =
  '# Generated by tsdevstack. Do not edit: changes are overwritten.';

/**
 * Framework plugin that removes client-sent identity headers before any auth
 * plugin runs (global plugin in kong.tsdevstack.yml). Source:
 * templates/kong-plugins/tsdevstack-strip-identity.
 */
export const KONG_STRIP_IDENTITY_PLUGIN_NAME = 'tsdevstack-strip-identity';

/**
 * Framework plugin on each partner service that removes the public partner
 * prefix from the upstream path. Source: templates/kong-plugins/tsdevstack-api-prefix.
 */
export const KONG_API_PREFIX_PLUGIN_NAME = 'tsdevstack-api-prefix';

/**
 * Public path prefix of partner API routes (/api/{globalPrefix}/...).
 * Backends serve the same paths without it.
 */
export const KONG_PARTNER_PATH_PREFIX = '/api';

/**
 * Header carrying the Kong trust token (removed and re-added by the global
 * request-transformer).
 */
export const KONG_TRUST_HEADER = 'X-Kong-Trust';

/**
 * Header with Kong's request id (removed by the global request-transformer).
 */
export const KONG_REQUEST_ID_HEADER = 'X-Kong-Request-Id';

/**
 * Identity headers only Kong may set, cleared from every client request by
 * tsdevstack-strip-identity before any auth plugin runs. Set by the OIDC
 * plugin (X-Userinfo, X-ID-Token, X-Access-Token), Kong's auth plugins
 * (X-Consumer-*, X-Credential-Identifier, X-Anonymous-Consumer,
 * X-Authenticated-*), the API key plugin (X-Api-Key-*) and the
 * request-transformer (X-Kong-Trust).
 *
 * Must match HEADERS in templates/kong-plugins/tsdevstack-strip-identity/handler.lua
 * (a test compares them).
 */
export const KONG_CLIENT_IDENTITY_HEADERS = [
  'X-Userinfo',
  'X-ID-Token',
  'X-Access-Token',
  'X-Consumer-ID',
  'X-Consumer-Custom-ID',
  'X-Consumer-Username',
  'X-Consumer-Groups',
  'X-Credential-Identifier',
  'X-Anonymous-Consumer',
  'X-Authenticated-Groups',
  'X-Authenticated-Scope',
  'X-Authenticated-UserId',
  'X-Api-Key-Id',
  'X-Api-Key-Consumer',
  KONG_TRUST_HEADER,
] as const;

/**
 * Methods added to every generated route next to the OpenAPI methods, so the
 * global cors plugin can answer browser preflights (a route without OPTIONS
 * returns 404 to the preflight).
 */
export const KONG_ROUTE_EXTRA_METHODS = ['OPTIONS'] as const;

/**
 * Regex pattern for one OpenAPI path parameter segment ({id}) in generated
 * Kong routes: exactly one non-empty path segment.
 */
export const KONG_PATH_PARAM_PATTERN = '[^/]+';

/**
 * Framework plugin on each partner service that checks dynamic API keys
 * against Redis. Source: templates/kong-plugins/tsdevstack-api-key.
 */
export const KONG_API_KEY_PLUGIN_NAME = 'tsdevstack-api-key';

/**
 * Request headers the partner API key is read from (`key_names` of the
 * tsdevstack-api-key plugin).
 */
export const KONG_API_KEY_HEADER_NAMES = ['x-api-key'] as const;

/**
 * Kong's bundled rate limiter: the user's global limiter in kong.user.yml,
 * and the per-IP ceiling on partner services.
 */
export const KONG_RATE_LIMITING_PLUGIN_NAME = 'rate-limiting';

/**
 * Default per-IP ceiling on partner services (requests per minute per client
 * IP), when `framework.apiKeys.ipLimitPerMinute` is not set. It bounds key
 * guessing; it is not a usage limit.
 */
export const KONG_API_KEY_IP_LIMIT_PER_MINUTE_DEFAULT = 600;

/**
 * Windows of the global rate-limiting plugin that become the key plugin's
 * `default_limits` (same names in both plugins).
 */
export const KONG_API_KEY_DEFAULT_LIMIT_WINDOWS = [
  'minute',
  'hour',
  'day',
  'month',
] as const;

/**
 * Windows of the global rate-limiting plugin the key plugin has no
 * equivalent for: ignored for partner keys, with a warning.
 */
export const KONG_API_KEY_UNSUPPORTED_LIMIT_WINDOWS = [
  'second',
  'year',
] as const;
