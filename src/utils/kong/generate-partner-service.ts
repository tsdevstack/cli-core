/**
 * Generates the Kong service for a backend's partner API routes
 */

import type { KongService, ServiceRouteConfig } from './types';
import { KONG_PARTNER_PATH_PREFIX } from '../../constants';
import { generateApiPrefixPlugin } from './generate-api-prefix-plugin';
import { generateExactRoutes } from './generate-exact-routes';
import { generateApiKeyPlugin } from './generate-api-key-plugin';
import { generateIpCeilingPlugin } from './generate-ip-ceiling-plugin';

/**
 * Partner routes: one exact route per `@PartnerApi()` path, published under
 * `/api` (`/api/offers/v1/plans` for the OpenAPI path `/offers/v1/plans`).
 * Only those paths and methods are reachable with a partner key.
 *
 * Plugins on the service: the per-IP ceiling (service-scoped rate-limiting,
 * replaces the global limiter here), tsdevstack-api-key (key check and the
 * key's limits, with the global limits as defaults) and
 * tsdevstack-api-prefix.
 *
 * Routes keep `strip_path: false` (Kong would strip the whole regex match);
 * tsdevstack-api-prefix on the service removes `/api` from the upstream
 * path, so the backend receives the OpenAPI path. The service URL has no
 * path.
 *
 * @param config - Service route configuration
 * @returns Kong service `{serviceName}-partner`
 */
export function generatePartnerService(
  config: ServiceRouteConfig,
): KongService {
  const name = `${config.serviceName}-partner`;

  return {
    name,
    url: config.serviceUrl,
    routes: generateExactRoutes({
      routes: config.groupedRoutes.partner,
      namePrefix: name,
      pathPrefix: KONG_PARTNER_PATH_PREFIX,
    }),
    plugins: [
      generateIpCeilingPlugin(config.partnerApi.ipLimitPerMinute),
      generateApiKeyPlugin(config.partnerApi.defaultLimits),
      generateApiPrefixPlugin(),
    ],
  };
}
