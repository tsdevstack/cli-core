/**
 * Group routes by path, preserving methods
 */

import type { RouteSecurityInfo } from './types';

/**
 * Groups routes by path, preserving methods.
 *
 * @param routes - Array of route security information
 * @returns Map of path to methods
 */
export function groupRoutesByPath(
  routes: RouteSecurityInfo[],
): Map<string, string[]> {
  const pathMap = new Map<string, string[]>();

  for (const route of routes) {
    const methods = pathMap.get(route.path) || [];
    methods.push(route.method);
    pathMap.set(route.path, methods);
  }

  return pathMap;
}
