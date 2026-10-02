/**
 * Generates Kong services and routes based on security types
 */

import type { KongService, ServiceRouteConfig } from './types';
import { logger } from '../logger';
import { generateJwtService } from './generate-jwt-service';
import { generatePartnerService } from './generate-partner-service';
import { generatePublicService } from './generate-public-service';

export type { ServiceRouteConfig } from './types';

/**
 * Generates Kong services (up to 3: public, JWT, partner) for a single
 * backend service. Every route is exact: anchored path, OpenAPI methods plus
 * OPTIONS; anything else gets 404 from Kong. Local (generate-kong) and cloud
 * (infra:generate-kong) generation both use this function.
 *
 * Warns about OpenAPI paths outside the service's global prefix (their
 * partner URL is `/api` + the path, not `/api/{globalPrefix}/...`).
 *
 * @param config - Service route configuration
 * @returns Array of Kong service definitions
 */
export function generateSecurityBasedServices(
  config: ServiceRouteConfig,
): KongService[] {
  const { groupedRoutes } = config;
  const services: KongService[] = [];

  const prefix = `/${config.globalPrefix}`;
  const outside = [
    ...new Set(
      [...groupedRoutes.public, ...groupedRoutes.jwt, ...groupedRoutes.partner]
        .map((route) => route.path)
        .filter((path) => path !== prefix && !path.startsWith(`${prefix}/`)),
    ),
  ].sort();
  if (outside.length > 0) {
    logger.warn(
      `   ${config.serviceName}: OpenAPI paths outside the global prefix "/${config.globalPrefix}": ${outside.join(', ')}`,
    );
  }

  if (groupedRoutes.public.length > 0) {
    services.push(generatePublicService(config));
  }

  if (groupedRoutes.jwt.length > 0) {
    services.push(generateJwtService(config));
  }

  if (groupedRoutes.partner.length > 0) {
    services.push(generatePartnerService(config));
  }

  return services;
}
