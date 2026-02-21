/**
 * Get next available port for a new service
 *
 * Starts at 3000, increments by 1 for each new service.
 */

import type { FrameworkConfig } from '../config/types';

export function getNextPort(config: FrameworkConfig): number {
  // Filter out workers (no port) and get used ports
  const usedPorts = config.services
    .filter((s) => s.port !== undefined)
    .map((s) => s.port as number);
  if (usedPorts.length === 0) {
    return 3000;
  }
  return Math.max(...usedPorts) + 1;
}