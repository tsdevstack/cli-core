/**
 * Load and flatten .secrets.local.json to key-value pairs
 */

import { findProjectRoot } from '../paths';
import type { Secrets } from './types';
import { loadLocalSecretsFile } from './load-local-secrets-file';
import { toScreamingSnakeCase } from './to-screaming-snake-case';

/**
 * Load .secrets.local.json and flatten to simple key-value pairs
 * Handles nested objects like REDIS and extracts DB passwords from DATABASE_URLs
 *
 * @param extractDbPasswords - Whether to extract DB passwords from DATABASE_URLs (default: false)
 * @param rootDir - Project root directory (defaults to findProjectRoot())
 * @returns Flattened secrets as Secrets (Record<string, string>)
 * @throws {CliError} If secrets file not found
 */
export function loadLocalSecrets(
  extractDbPasswords: boolean = false,
  rootDir: string = findProjectRoot(),
): Secrets {
  const secretsFile = loadLocalSecretsFile(rootDir);

  const resolved: Record<string, string> = {};

  // 1. Extract framework-wide secrets from the "secrets" key
  const secretsObject = secretsFile.secrets || {};
  for (const [key, value] of Object.entries(secretsObject)) {
    if (typeof value === 'string') {
      resolved[key] = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Handle nested objects like REDIS: { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD }
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        if (typeof nestedValue === 'string') {
          resolved[nestedKey] = nestedValue;
        }
      }
    }
  }

  // 2. Extract service-specific environment variables
  for (const [serviceName, serviceConfig] of Object.entries(secretsFile)) {
    // Skip metadata keys
    if (serviceName === 'secrets' || serviceName.startsWith('$')) {
      continue;
    }

    if (serviceConfig && typeof serviceConfig === 'object') {
      // Extract all key-value pairs from service config
      for (const [key, value] of Object.entries(serviceConfig)) {
        // Add service-specific environment variables (will overwrite if duplicates)
        if (typeof value === 'string') {
          resolved[key] = value;
        }

        // Optionally extract DB passwords from DATABASE_URLs
        if (
          extractDbPasswords &&
          key === 'DATABASE_URL' &&
          typeof value === 'string'
        ) {
          // Extract password from postgresql://user:password@host:port/db
          const match = value.match(/postgresql:\/\/([^:]+):([^@]+)@/);
          if (match) {
            const username = match[1];
            const password = match[2];
            // Store as SERVICE_DB_PASSWORD (e.g., AUTH_DB_PASSWORD)
            // Remove '-service' suffix first, then convert to SCREAMING_SNAKE_CASE
            const serviceNameWithoutSuffix = serviceName.replace(
              /-service$/,
              '',
            );
            const prefix = toScreamingSnakeCase(serviceNameWithoutSuffix);
            resolved[`${prefix}_DB_PASSWORD`] = password;
            resolved[`${prefix}_DB_USER`] = username;
          }
        }
      }
    }
  }

  return resolved;
}
