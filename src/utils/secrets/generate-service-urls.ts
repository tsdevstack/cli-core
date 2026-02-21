/**
 * Generate service URLs for inter-service communication
 * Preserves existing URLs, only generates missing ones
 * Frontend services are skipped (they don't need their URLs exposed)
 */

import type { FrameworkConfig } from '../config';
import { FRONTEND_TYPES } from '../../constants';
import { toScreamingSnakeCase } from './to-screaming-snake-case';

/**
 * Generate service URLs for backend services in the config
 * Used for inter-service communication and service discovery
 * Frontend services are skipped as they don't need URLs exposed
 *
 * @param config - Framework configuration
 * @param existingSecrets - Existing secrets object (preserves existing URLs)
 * @param environment - Target environment ('local' or 'cloud'), defaults to 'local'
 * @returns Updated secrets object with service URLs
 */
export function generateServiceUrls(
  config: FrameworkConfig,
  existingSecrets: Record<string, string> = {},
  environment: 'local' | 'cloud' = 'local'
): Record<string, string> {
  const secrets = { ...existingSecrets };

  for (const service of config.services) {
    const isFrontend = (FRONTEND_TYPES as readonly string[]).includes(service.type);

    // Skip frontend services - they don't need their URLs exposed to other services
    if (isFrontend) {
      continue;
    }

    const urlKey = `${toScreamingSnakeCase(service.name)}_URL`;

    // Only generate if doesn't exist (preserve existing URLs)
    if (!secrets[urlKey]) {
      // Generate URL based on environment:
      // - local: http://localhost:{port} (for local development)
      // - cloud: http://{service-name}:{port} (for VPC DNS)
      const baseUrl = environment === 'cloud'
        ? `http://${service.name}`
        : 'http://localhost';

      secrets[urlKey] = `${baseUrl}:${service.port}`;
    }
  }

  return secrets;
}