/**
 * Sync user secrets structure with current config
 */

import type { FrameworkConfig } from '../config';
import type { SecretsFile } from './types';
import { createServiceSection } from './create-service-section';

/**
 * Sync user secrets structure with current config
 * Adds missing services and removes orphaned ones
 *
 * @param existingUserSecrets - Current user secrets file
 * @param config - Framework configuration
 * @returns Updated user secrets (or null if no changes needed)
 */
export function syncUserSecretsStructure(
  existingUserSecrets: SecretsFile,
  config: FrameworkConfig,
): SecretsFile | null {
  let updated = false;
  const result = { ...existingUserSecrets };

  // Update top-level secrets with missing service URLs and user-defined values only
  // IMPORTANT: DO NOT add framework-generated secrets (JWT keys, API keys, KONG_TRUST_TOKEN, etc.)
  // Those belong in .secrets.tsdevstack.json, not .secrets.user.json
  const currentSecrets = result.secrets || {};

  // Add TTL values if missing (user can customize these)
  if (!currentSecrets.ACCESS_TOKEN_TTL) {
    currentSecrets.ACCESS_TOKEN_TTL = '900'; // 15 minutes
    updated = true;
  }
  if (!currentSecrets.REFRESH_TOKEN_TTL) {
    currentSecrets.REFRESH_TOKEN_TTL = '604800'; // 7 days
    updated = true;
  }
  if (!currentSecrets.CONFIRMATION_TOKEN_TTL) {
    currentSecrets.CONFIRMATION_TOKEN_TTL = '86400'; // 24 hours (in seconds)
    updated = true;
  }

  // Add APP_URL if missing (frontend URL for email links)
  if (currentSecrets.APP_URL === undefined) {
    currentSecrets.APP_URL = ''; // User must configure for their environment
    updated = true;
  }

  // Add DOMAIN if missing (base domain for cloud deployment)
  if (currentSecrets.DOMAIN === undefined) {
    currentSecrets.DOMAIN = ''; // User must configure for cloud deployment
    updated = true;
  }

  // Update result.secrets if any values were added
  if (updated) {
    result.secrets = currentSecrets;
  }

  // Remove orphaned service sections (services no longer in config)
  const configServiceNames = new Set(config.services.map((s) => s.name));

  for (const key of Object.keys(result)) {
    if (key === 'secrets' || key.startsWith('$')) continue;
    if (!configServiceNames.has(key)) {
      delete result[key];
      updated = true;
    }
  }

  // Add missing service sections and sync existing ones
  for (const service of config.services) {
    const existingService = result[service.name];

    if (!existingService) {
      // New service - create it
      result[service.name] = createServiceSection(service);
      updated = true;
    } else if (
      typeof existingService === 'object' &&
      !Array.isArray(existingService)
    ) {
      // Existing service - merge its secrets array to preserve user additions
      const expectedSection = createServiceSection(service);
      const existingServiceObj = existingService as Record<string, unknown>;
      const expectedSectionObj = expectedSection as unknown as Record<
        string,
        unknown
      >;
      const existingSecrets = existingServiceObj.secrets;
      const expectedSecrets = expectedSectionObj.secrets;

      // Remove deprecated ALLOWED_ORIGINS property (apps are not called directly, everything goes through Kong)
      if ('ALLOWED_ORIGINS' in existingServiceObj) {
        delete existingServiceObj.ALLOWED_ORIGINS;
        updated = true;
      }

      // Merge secrets arrays: preserve existing + add new expected ones
      if (Array.isArray(existingSecrets) && Array.isArray(expectedSecrets)) {
        // Combine and deduplicate using Set
        const combined = [...existingSecrets, ...expectedSecrets];
        const mergedSecrets = Array.from(new Set(combined));

        // Only update if the merged result is different from existing
        if (JSON.stringify(existingSecrets) !== JSON.stringify(mergedSecrets)) {
          existingServiceObj.secrets = mergedSecrets;
          updated = true;
        }
      } else if (
        JSON.stringify(existingSecrets) !== JSON.stringify(expectedSecrets)
      ) {
        // If one is not an array, fall back to replacement
        existingServiceObj.secrets = expectedSecrets;
        updated = true;
      }
    }
  }

  return updated ? result : null;
}
