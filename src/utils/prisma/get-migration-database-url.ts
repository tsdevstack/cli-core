/**
 * Get the URL local migrations run with, pointed at localhost
 *
 * Reads the owner role's URL (MIGRATION_DATABASE_URL, or DATABASE_URL in
 * secrets made before the app role existed) from .secrets.local.json and
 * replaces the Docker hostname (e.g., auth-db:5432) with localhost:5432 for
 * CLI access. The running service connects as the app role (DATABASE_URL),
 * which can't change the schema.
 *
 * @param serviceName - Name of the service
 * @returns The owner's URL with localhost, or null if not found
 */

import { loadServiceSecrets } from '../secrets';
import { pickOwnerDatabaseUrl } from '../database/pick-owner-database-url';

export function getMigrationDatabaseUrl(serviceName: string): string | null {
  const databaseUrl = pickOwnerDatabaseUrl(loadServiceSecrets(serviceName));

  if (!databaseUrl) {
    return null;
  }

  // Replace Docker hostname with localhost for CLI access
  // e.g., auth-db:5432 -> localhost:5432
  return databaseUrl.replace(/@[^:]+:/, '@localhost:');
}
