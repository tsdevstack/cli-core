/**
 * Kong plugin configuration types
 */

/**
 * JWT-OIDC plugin configuration for Kong Gateway (kong-oidc-v3)
 * Using bearer-only mode for JWT validation via JWKS
 */
export interface JwtOidcPluginConfig {
  name: 'oidc';
  config: {
    client_id: string;
    client_secret: string;
    discovery: string;
    bearer_only: 'yes' | 'no';
    bearer_jwt_auth_enable: 'yes' | 'no';
    ssl_verify: 'yes' | 'no' | string; // string allows ${KONG_SSL_VERIFY} placeholder
    userinfo_header_name?: string;
    scope?: string;
    unauth_action?: 'auth' | 'deny';
  };
}

/**
 * Redis connection block of Kong plugins (fields of kong.tools.redis.schema).
 * The framework writes placeholders, resolved from secrets (local) or the
 * cloud secret manager (infra:build-kong); cli-infra adds `ssl` and
 * `ssl_verify` on AWS and Azure.
 */
export interface KongRedisConfig {
  host: string;
  port: string | number;
  password: string;
  database: number;
  timeout: number;
  ssl?: boolean;
  ssl_verify?: boolean;
}

/**
 * Per-window limits for API keys without their own limit for that window
 * (`default_limits` of tsdevstack-api-key). Values are copied from the
 * global rate-limiting plugin as written in kong.user.yml (a number, or a
 * `${PLACEHOLDER}` resolved like the global limiter's).
 */
export interface ApiKeyDefaultLimits {
  minute?: number | string;
  hour?: number | string;
  day?: number | string;
  week?: number | string;
  month?: number | string;
}

/**
 * tsdevstack-api-key plugin configuration (see its schema.lua)
 */
export interface ApiKeyPluginConfig {
  name: 'tsdevstack-api-key';
  config: {
    /** Request headers the key is read from */
    key_names: string[];
    redis: KongRedisConfig;
    default_limits: ApiKeyDefaultLimits;
  };
}

/**
 * Per-IP ceiling on a partner service: Kong's bundled rate-limiting scoped
 * to the service (replaces the global limiter there), counted per client IP.
 */
export interface IpCeilingPluginConfig {
  name: 'rate-limiting';
  config: {
    minute: number;
    limit_by: 'ip';
    policy: 'redis';
    hide_client_headers: false;
    redis: KongRedisConfig;
  };
}

/**
 * tsdevstack-strip-identity plugin configuration (no settings)
 */
export interface StripIdentityPluginConfig {
  name: 'tsdevstack-strip-identity';
  config: Record<string, never>;
}

/**
 * tsdevstack-api-prefix plugin configuration
 */
export interface ApiPrefixPluginConfig {
  name: 'tsdevstack-api-prefix';
  config: {
    /** Public path prefix removed from the upstream path, e.g. /api */
    prefix: string;
  };
}
