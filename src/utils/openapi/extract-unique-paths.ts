/**
 * Extract unique paths from routes for Kong path configuration
 */

import type { RouteSecurityInfo } from './types';

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
