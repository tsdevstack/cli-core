/**
 * Process CORS origins in Kong configuration
 * Converts comma-separated string to array format
 */

import type { KongTemplate } from './types';
import { logger } from '../logger';

/**
 * Post-process CORS plugin configuration
 * Converts comma-separated origins string to array
 * Handles unresolved placeholders gracefully
 *
 * Supports two formats:
 * - origins: "value1,value2" (string)
 * - origins: ["value1,value2"] (array with single comma-separated string)
 *
 * @param config - Kong configuration with potential CORS plugin
 */
export function processCorsOrigins(config: KongTemplate): void {
  const corsPlugin = config.plugins?.find((p) => p.name === 'cors');

  if (!corsPlugin) {
    return;
  }

  const origins = corsPlugin.config.origins;
  let originsString: string | undefined;

  // Handle both formats: string or array with single comma-separated string
  if (typeof origins === 'string') {
    originsString = origins;
  } else if (
    Array.isArray(origins) &&
    origins.length === 1 &&
    typeof origins[0] === 'string' &&
    origins[0].includes(',')
  ) {
    // Array with single comma-separated string element
    originsString = origins[0];
  } else {
    // Already properly formatted array or empty - nothing to do
    return;
  }

  // If placeholder wasn't resolved, set to empty array
  if (!originsString || originsString === '${KONG_CORS_ORIGINS}') {
    corsPlugin.config.origins = [];
    logger.warn('   CORS origins not configured');
    return;
  }

  // Convert comma-separated string to array
  corsPlugin.config.origins = originsString
    .split(',')
    .map((s: string) => s.trim());

  logger.info(`   📡 CORS origins: ${(corsPlugin.config.origins as string[]).join(', ')}`);
}