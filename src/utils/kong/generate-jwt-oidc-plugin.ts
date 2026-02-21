/**
 * Generates Kong jwt-oidc plugin configuration
 */

import { KONG_OIDC_CLIENT_ID, KONG_OIDC_CLIENT_SECRET } from '../../constants';
import type { JwtOidcPluginConfig } from './plugin-types';

export interface JwtOidcPluginOptions {
  /**
   * Direct OIDC discovery URL.
   * Takes precedence over authServiceUrl/authServicePrefix if set.
   */
  discoveryUrl?: string;
  /**
   * Auth service base URL (e.g., ${KONG_SERVICE_HOST}:3001).
   * Used with authServicePrefix to construct discovery URL.
   */
  authServiceUrl?: string;
  /**
   * Auth service global prefix (e.g., 'auth').
   */
  authServicePrefix?: string;
}

/**
 * Generates Kong jwt-oidc plugin configuration.
 *
 * Configures Kong to validate JWTs using OIDC discovery endpoint.
 * Supports two modes:
 * 1. Auth template mode: Uses authServiceUrl + authServicePrefix to construct discovery URL
 * 2. External OIDC mode: Uses discoveryUrl directly (e.g., Auth0, Cognito)
 *
 * SSL verification uses the ${KONG_SSL_VERIFY} placeholder which resolves to:
 * - Local development: 'no' (no SSL to verify for internal HTTP)
 * - Cloud deployment: 'yes' (verify SSL certificates for HTTPS)
 *
 * @param options - JWT OIDC plugin options
 * @returns JWT-OIDC plugin configuration
 */
export function generateJwtOidcPlugin(options: JwtOidcPluginOptions): JwtOidcPluginConfig {
  // Direct discovery URL takes precedence
  const discoveryEndpoint = options.discoveryUrl
    ?? `${options.authServiceUrl}/${options.authServicePrefix}/.well-known/openid-configuration`;

  return {
    name: 'oidc',
    config: {
      client_id: KONG_OIDC_CLIENT_ID,
      client_secret: KONG_OIDC_CLIENT_SECRET,
      discovery: discoveryEndpoint,
      bearer_only: 'yes',
      bearer_jwt_auth_enable: 'yes',
      // Use placeholder - resolved from secrets: 'no' for local, 'yes' for cloud
      ssl_verify: '${KONG_SSL_VERIFY}',
      // Return 401 Unauthorized instead of redirecting to login page
      // 'auth' (default) = redirect, 'deny' = return 401
      unauth_action: 'deny',
      // Note: claims forwarding not directly supported by kong-oidc-v3
      // Claims are available in X-Userinfo header as JSON
      userinfo_header_name: 'X-Userinfo',
    },
  };
}