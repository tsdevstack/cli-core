/**
 * Get DATABASE_URL for a service from secrets and convert to localhost
 *
 * Reads the DATABASE_URL from .secrets.local.json and replaces the Docker
 * hostname (e.g., auth-db:5432) with localhost:5432 for CLI access.
 *
 * @param serviceName - Name of the service
 * @returns DATABASE_URL with localhost, or null if not found
 */

import { loadServiceSecrets } from '../secrets';

export function getDatabaseUrl(serviceName: string): string | null {
  const serviceSecrets = loadServiceSecrets(serviceName);

  if (!serviceSecrets) {
    return null;
  }

  const databaseUrl = serviceSecrets.DATABASE_URL;

  if (!databaseUrl || typeof databaseUrl !== 'string') {
    return null;
  }

  // Replace Docker hostname with localhost for CLI access
  // e.g., auth-db:5432 -> localhost:5432
  return databaseUrl.replace(/@[^:]+:/, '@localhost:');
}