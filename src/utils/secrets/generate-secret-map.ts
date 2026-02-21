/**
 * Generate secret-map.json from framework + user secrets
 *
 * Extracts per-service secret key arrays by merging the framework and user
 * secrets arrays (before mergeSecrets resolves and deletes them).
 * The resulting map is committed to git and used by deploy commands
 * to scope which secrets each service receives.
 */

import type { SecretsFile } from './types';
import type { FrameworkConfig } from '../config';

/**
 * Extract the secrets array from a service entry in a SecretsFile
 */
function getSecretsArray(
  secretsFile: SecretsFile,
  serviceName: string,
): string[] {
  const entry = secretsFile[serviceName];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return [];
  }
  const secrets = (entry as Record<string, unknown>).secrets;
  return Array.isArray(secrets) ? (secrets as string[]) : [];
}

/**
 * Check if a service entry has a DATABASE_URL
 */
function hasDatabaseUrl(
  secretsFile: SecretsFile,
  serviceName: string,
): boolean {
  const entry = secretsFile[serviceName];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return false;
  }
  return 'DATABASE_URL' in (entry as Record<string, unknown>);
}

/**
 * Generate a map of service names to their referenced secret keys
 *
 * Takes framework and user secrets separately because mergeSecrets()
 * resolves and deletes the secrets arrays. This function merges the
 * arrays itself (deduplicated union).
 *
 * @param frameworkSecrets - Framework-generated secrets file
 * @param userSecrets - User-provided secrets file
 * @param config - Framework configuration
 * @returns Record mapping service names to arrays of secret key names
 */
export function generateSecretMap(
  frameworkSecrets: SecretsFile,
  userSecrets: SecretsFile,
  config: FrameworkConfig,
): Record<string, string[]> {
  const secretMap: Record<string, string[]> = {};

  for (const service of config.services) {
    // Workers share secrets with their base service — skip them
    if (service.type === 'worker') {
      continue;
    }

    const fwKeys = getSecretsArray(frameworkSecrets, service.name);
    const userKeys = getSecretsArray(userSecrets, service.name);

    // Deduplicated union of framework + user secret keys
    const keys = Array.from(new Set([...fwKeys, ...userKeys]));

    // Include DATABASE_URL if present in either source (backend services with databases)
    if (
      hasDatabaseUrl(frameworkSecrets, service.name) ||
      hasDatabaseUrl(userSecrets, service.name)
    ) {
      keys.push('DATABASE_URL');
    }

    secretMap[service.name] = keys;
  }

  return secretMap;
}
