/**
 * Generates the Kong service for a backend's JWT-protected routes
 */

import type { KongService, ServiceRouteConfig } from './types';
import { generateExactRoutes } from './generate-exact-routes';
import { generateJwtOidcPlugin } from './generate-jwt-oidc-plugin';

/**
 * JWT routes: the OIDC plugin validates the bearer token and sets X-Userinfo.
 * One exact route per OpenAPI path; the backend receives the path unchanged.
 *
 * @param config - Service route configuration
 * @returns Kong service `{serviceName}-jwt` with the oidc plugin
 */
export function generateJwtService(config: ServiceRouteConfig): KongService {
  const name = `${config.serviceName}-jwt`;

  return {
    name,
    url: config.serviceUrl,
    routes: generateExactRoutes({
      routes: config.groupedRoutes.jwt,
      namePrefix: name,
    }),
    plugins: [
      generateJwtOidcPlugin({
        discoveryUrl: config.oidcDiscoveryUrl,
        authServiceUrl: config.authServiceUrl,
        authServicePrefix: config.authServicePrefix,
      }),
    ],
  };
}
