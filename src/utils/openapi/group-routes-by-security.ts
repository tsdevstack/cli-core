/**
 * Groups routes by their security type for Kong service generation
 */

import type { RouteSecurityInfo } from './types';

export interface GroupedRoutes {
  public: RouteSecurityInfo[];
  jwt: RouteSecurityInfo[];
  partner: RouteSecurityInfo[];
}

/**
 * Groups routes by their security type for Kong service generation.
 *
 * @param routes - Array of route security information
 * @returns Routes grouped by security type
 */
export function groupRoutesBySecurity(
  routes: RouteSecurityInfo[],
): GroupedRoutes {
  const grouped: GroupedRoutes = {
    public: [],
    jwt: [],
    partner: [],
  };

  for (const route of routes) {
    grouped[route.securityType].push(route);
  }

  return grouped;
}
