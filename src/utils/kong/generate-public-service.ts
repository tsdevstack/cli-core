/**
 * Generates the Kong service for a backend's public routes
 */

import type { KongService, ServiceRouteConfig } from './types';
import { generateExactRoutes } from './generate-exact-routes';

/**
 * Public routes: no authentication. One exact route per OpenAPI path; the
 * backend receives the path unchanged (it already includes the global prefix).
 *
 * @param config - Service route configuration
 * @returns Kong service `{serviceName}-public`
 */
export function generatePublicService(config: ServiceRouteConfig): KongService {
  const name = `${config.serviceName}-public`;

  return {
    name,
    url: config.serviceUrl,
    routes: generateExactRoutes({
      routes: config.groupedRoutes.public,
      namePrefix: name,
    }),
  };
}
