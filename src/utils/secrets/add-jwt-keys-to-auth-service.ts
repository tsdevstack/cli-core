/**
 * Add user secrets references to auth service secrets array
 *
 * Note: As of Phase 8, JWT keys are in framework file, not user file.
 * This function adds user-level secret references (TTLs + APP_URL) for auth-service.
 */

import { AUTH_USER_SECRETS } from '../../constants';
import type { SecretsFile } from './types';

/**
 * Add user secret references to auth service if auth template is enabled
 * Mutates the secrets file in place
 *
 * @param file - Secrets file to modify
 * @param useAuthTemplate - Whether auth template is enabled (fullstack-auth or auth)
 * @returns true if secrets were added, false otherwise
 */
export function addJwtKeysToAuthService(
  file: SecretsFile,
  useAuthTemplate: boolean | undefined,
): boolean {
  if (!useAuthTemplate || !file['auth-service']) {
    return false;
  }

  const authService = file['auth-service'] as { secrets: string[] };
  const hasAllSecrets = AUTH_USER_SECRETS.every((key) =>
    authService.secrets.includes(key),
  );

  if (hasAllSecrets) {
    return false;
  }

  // Add missing user secret references
  const missingSecrets = AUTH_USER_SECRETS.filter(
    (key) => !authService.secrets.includes(key),
  );
  authService.secrets = [...authService.secrets, ...missingSecrets];

  return true;
}
