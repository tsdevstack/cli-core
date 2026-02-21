/**
 * Generate API keys for backend services
 * Preserves existing keys, only generates missing ones
 * Frontend services don't get API keys
 */

import type { FrameworkConfig } from '../config';
import { generateHexSecret } from './generate-hex-secret';
import { toScreamingSnakeCase } from './to-screaming-snake-case';
import { FRONTEND_TYPES } from '../../constants';

/**
 * Generate API keys for backend services in the config
 * Frontend services (Next.js, React, Vue, Angular) don't get API keys
 * Only backend services get unique API keys
 *
 * @param config - Framework configuration
 * @param existingSecrets - Existing secrets object (preserves existing keys)
 * @returns Updated secrets object with API keys
 */
export function generateServiceApiKeys(
  config: FrameworkConfig,
  existingSecrets: Record<string, string> = {},
): Record<string, string> {
  const secrets = { ...existingSecrets };

  for (const service of config.services) {
    const isFrontend = (FRONTEND_TYPES as readonly string[]).includes(
      service.type,
    );

    // Skip frontend services - they don't need API keys
    if (isFrontend) {
      continue;
    }

    const keyName = `${toScreamingSnakeCase(service.name)}_API_KEY`;

    // Only generate if doesn't exist (preserve existing keys)
    if (!secrets[keyName]) {
      secrets[keyName] = generateHexSecret(32);
    }
  }

  return secrets;
}
