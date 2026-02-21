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