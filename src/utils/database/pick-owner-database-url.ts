/**
 * Pick the owner role's URL from a service's secrets
 */

import { MIGRATION_DATABASE_URL_KEY } from '../../constants';

/**
 * The URL of the role that owns the service's tables: MIGRATION_DATABASE_URL,
 * or DATABASE_URL in secrets made before the app role existed (it held the
 * owner then). Locally the owner is also the Postgres container's superuser.
 *
 * @param serviceSecrets - A service's section of a secrets file
 * @returns The owner's URL, or undefined when the service has none
 */
export function pickOwnerDatabaseUrl(
  serviceSecrets: unknown,
): string | undefined {
  if (!serviceSecrets || typeof serviceSecrets !== 'object') {
    return undefined;
  }
  const migrationUrl: unknown = Reflect.get(
    serviceSecrets,
    MIGRATION_DATABASE_URL_KEY,
  );
  if (typeof migrationUrl === 'string' && migrationUrl) {
    return migrationUrl;
  }
  const databaseUrl: unknown = Reflect.get(serviceSecrets, 'DATABASE_URL');
  return typeof databaseUrl === 'string' && databaseUrl
    ? databaseUrl
    : undefined;
}
