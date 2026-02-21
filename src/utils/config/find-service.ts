/**
 * Find a service by name in framework configuration
 */

import { loadFrameworkConfig } from "./load-framework-config";
import type { FrameworkService } from "./types";

/**
 * Find a service by name in framework configuration
 *
 * @param serviceName - Name of the service to find
 * @returns Service object if found, null otherwise
 */
export function findService(serviceName: string): FrameworkService | null {
  const config = loadFrameworkConfig();
  return config.services.find((s) => s.name === serviceName) || null;
}