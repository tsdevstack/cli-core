/**
 * Groups routes by their security type for Kong service generation
 */

import type { RouteSecurityInfo } from "./types";

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
  routes: RouteSecurityInfo[]
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

/**
 * Extracts unique paths from routes (for Kong path configuration).
 *
 * @param routes - Array of route security information
 * @returns Array of unique paths
 */
export function extractUniquePaths(routes: RouteSecurityInfo[]): string[] {
  const pathSet = new Set(routes.map((r) => r.path));
  return Array.from(pathSet).sort();
}

/**
 * Groups routes by path, preserving methods.
 *
 * @param routes - Array of route security information
 * @returns Map of path to methods
 */
export function groupRoutesByPath(
  routes: RouteSecurityInfo[]
): Map<string, string[]> {
  const pathMap = new Map<string, string[]>();

  for (const route of routes) {
    const methods = pathMap.get(route.path) || [];
    methods.push(route.method);
    pathMap.set(route.path, methods);
  }

  return pathMap;
}