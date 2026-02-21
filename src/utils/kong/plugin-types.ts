/**
 * Kong plugin configuration types for Phase 4
 */

/**
 * JWT-OIDC plugin configuration for Kong Gateway (kong-oidc-v3)
 * Using bearer-only mode for JWT validation via JWKS
 */
export interface JwtOidcPluginConfig {
  name: "oidc";
  config: {
    client_id: string;
    client_secret: string;
    discovery: string;
    bearer_only: "yes" | "no";
    bearer_jwt_auth_enable: "yes" | "no";
    ssl_verify: "yes" | "no" | string; // string allows ${KONG_SSL_VERIFY} placeholder
    userinfo_header_name?: string;
    scope?: string;
    unauth_action?: "auth" | "deny";
  };
}

/**
 * Key-Auth plugin configuration for Kong Gateway
 */
export interface KeyAuthPluginConfig {
  name: "key-auth";
  config: {
    key_names: string[];
    hide_credentials: boolean;
  };
}