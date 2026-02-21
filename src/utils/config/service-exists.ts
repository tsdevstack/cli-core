/**
 * Check if a service exists in framework configuration
 */

import { findService } from "./find-service";

/**
 * Check if a service exists in framework configuration
 *
 * @param serviceName - Name of the service to check
 * @returns true if service exists, false otherwise
 */
export function serviceExists(serviceName: string): boolean {
  return findService(serviceName) !== null;
}