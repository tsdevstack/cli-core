/**
 * Add TTL values to auth service secrets array in user file
 *
 * Note: As of Phase 8, JWT keys are in framework file, not user file.
 * This function now only adds TTL values for auth-service in the user file.
 * TTL values (ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL, CONFIRMATION_TOKEN_TTL) are in user file.
 */

import { AUTH_TTL_SECRETS } from '../../constants';
import type { SecretsFile } from './types';

/**
 * Add TTL values to auth service if auth template is enabled
 * Mutates the secrets file in place
 *
 * @param file - Secrets file to modify
 * @param useAuthTemplate - Whether auth template is enabled (fullstack-auth or auth)
 * @returns true if secrets were added, false otherwise
 */
export function addJwtKeysToAuthService(
  file: SecretsFile,
  useAuthTemplate: boolean | undefined
): boolean {
  if (!useAuthTemplate || !file['auth-service']) {
    return false;
  }

  const authService = file['auth-service'] as { secrets: string[] };
  const hasAllSecrets = AUTH_TTL_SECRETS.every(key => authService.secrets.includes(key));

  if (hasAllSecrets) {
    return false;
  }

  // Add missing TTL secrets
  const missingSecrets = AUTH_TTL_SECRETS.filter(key => !authService.secrets.includes(key));
  authService.secrets = [...authService.secrets, ...missingSecrets];

  return true;
}