/**
 * Merge framework and user secrets files
 *
 * Merges .secrets.tsdevstack.json + .secrets.user.json → .secrets.local.json
 * User values take precedence over framework values.
 *
 * Special handling:
 * - Skips metadata keys (starting with $)
 * - Shallow merge for secrets (all values are strings now, no nesting)
 * - Shallow merge for service sections (objects with arrays)
 */

import type { SecretsFile } from './types';
import { resolveApiKeyReferences } from './resolve-api-key-references';

/**
 * Merge framework and user secrets with user values taking precedence
 *
 * @param framework - Framework-generated secrets
 * @param user - User-provided secrets
 * @returns Merged secrets object (user values override framework)
 */
export function mergeSecrets(framework: SecretsFile, user: SecretsFile): SecretsFile {
  const result: SecretsFile = {
    secrets: {}
  };

  // 1. Merge top-level secrets (shallow merge - all values are strings)
  result.secrets = {
    ...framework.secrets,
    ...user.secrets,
  };

  // 2. Copy metadata keys from framework
  for (const key in framework) {
    if (key.startsWith('$')) {
      result[key] = framework[key];
    }
  }

  // 3. Get all service names (excluding metadata and secrets)
  const frameworkServices = Object.keys(framework).filter(k => !k.startsWith('$') && k !== 'secrets');
  const userServices = Object.keys(user).filter(k => !k.startsWith('$') && k !== 'secrets');
  const serviceNames = Array.from(new Set([...frameworkServices, ...userServices]));

  // 4. Merge service sections (shallow merge with special array handling)
  for (const serviceName of serviceNames) {
    const frameworkService = framework[serviceName];
    const userService = user[serviceName];

    // Both are objects - merge them
    if (
      frameworkService &&
      typeof frameworkService === 'object' &&
      !Array.isArray(frameworkService) &&
      userService &&
      typeof userService === 'object' &&
      !Array.isArray(userService)
    ) {
      // Shallow merge: user values override framework values
      const merged: Record<string, unknown> = {
        ...frameworkService,
        ...userService,
      };

      // Special handling for 'secrets' array: merge instead of override
      const frameworkSecrets = (frameworkService as Record<string, unknown>).secrets;
      const userSecrets = (userService as Record<string, unknown>).secrets;

      if (Array.isArray(frameworkSecrets) && Array.isArray(userSecrets)) {
        // Combine both arrays and remove duplicates (user secrets take precedence)
        merged.secrets = Array.from(new Set([...frameworkSecrets, ...userSecrets]));
      } else if (Array.isArray(frameworkSecrets)) {
        // Keep framework secrets if user doesn't have any
        merged.secrets = frameworkSecrets;
      }

      result[serviceName] = merged;
    } else if (userService !== undefined) {
      // User has a value (framework doesn't, or it's a primitive)
      result[serviceName] = userService;
    } else {
      // Only framework has a value
      result[serviceName] = frameworkService;
    }
  }

  // Resolve API_KEY references after merging
  const withResolvedApiKeys = resolveApiKeyReferences(result);

  // Resolve all references in secrets arrays
  return resolveSecretsArrayReferences(withResolvedApiKeys);
}

/**
 * Resolve all references in service "secrets" arrays to actual values
 * Adds resolved values as direct properties and removes the secrets array
 * Validates that all references can be resolved
 */
function resolveSecretsArrayReferences(secretsFile: SecretsFile): SecretsFile {
  const topLevelSecrets = secretsFile.secrets || {};

  for (const key in secretsFile) {
    // Skip metadata keys and the secrets section itself
    if (key === 'secrets' || key.startsWith('$')) {
      continue;
    }

    const section = secretsFile[key];

    // Check if section has a "secrets" array
    if (
      section &&
      typeof section === 'object' &&
      !Array.isArray(section) &&
      'secrets' in section
    ) {
      const secretsArray = (section as Record<string, unknown>).secrets;

      // If secrets is an array of references, resolve them to actual values
      if (Array.isArray(secretsArray)) {
        for (const reference of secretsArray) {
          if (typeof reference === 'string') {
            // Validate that the reference exists in top-level secrets
            if (!(reference in topLevelSecrets)) {
              throw new Error(
                `Secret reference "${reference}" not found in "secrets" section for service "${key}"`
              );
            }
            // Add resolved value as a direct property
            (section as Record<string, unknown>)[reference] = topLevelSecrets[reference];
          }
        }
        // Remove the secrets array - consumers don't need it in the final merged file
        delete (section as Record<string, unknown>).secrets;
      }
    }
  }

  return secretsFile;
}