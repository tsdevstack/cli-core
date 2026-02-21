/**
 * Auto-detect ALLOWED_ORIGINS from frontend services
 */

import type { FrameworkConfig } from '../config';
import { FRONTEND_TYPES } from '../../constants';

/**
 * Auto-detect ALLOWED_ORIGINS from frontend services
 *
 * @param config - Framework configuration
 * @returns Comma-separated list of allowed origins, or null if no frontend services
 */
export function autoDetectAllowedOrigins(config: FrameworkConfig): string | null {
  const frontendServices = config.services.filter((s) =>
    (FRONTEND_TYPES as readonly string[]).includes(s.type)
  );

  if (frontendServices.length === 0) {
    return null;
  }

  return frontendServices.map((s) => `http://localhost:${s.port}`).join(',');
}