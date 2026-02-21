/**
 * Resolve API_KEY references in service sections
 *
 * If a service has "API_KEY": "AUTH_SERVICE_API_KEY", replace with actual value
 * from top-level secrets section
 */

import type { SecretsFile } from './types';

/**
 * Resolve API_KEY references in service sections
 *
 * @param secretsFile - Secrets file with potential API_KEY references
 * @returns Secrets file with resolved API_KEY references
 */
export function resolveApiKeyReferences(secretsFile: SecretsFile): SecretsFile {
  const topLevelSecrets = secretsFile.secrets || {};

  for (const key in secretsFile) {
    // Skip metadata keys and the secrets section itself
    if (key === 'secrets' || key.startsWith('$')) {
      continue;
    }

    const section = secretsFile[key];

    // Check if section is an object with an API_KEY property
    if (
      section &&
      typeof section === 'object' &&
      !Array.isArray(section) &&
      'API_KEY' in section
    ) {
      const apiKey = (section as Record<string, unknown>).API_KEY;

      // If API_KEY is a string reference (not already resolved)
      if (typeof apiKey === 'string' && apiKey in topLevelSecrets) {
        // Resolve the reference to actual value
        (section as Record<string, unknown>).API_KEY = topLevelSecrets[apiKey];
      }
    }
  }

  return secretsFile;
}