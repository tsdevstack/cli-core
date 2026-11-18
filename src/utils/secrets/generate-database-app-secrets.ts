/**
 * Generate the local credentials of a service's app role
 */

import { buildDatabaseAppRole } from '../database/build-database-app-role';
import { parsePostgresUrl } from '../database/parse-postgres-url';
import { generateBase64Secret } from './generate-base64-secret';

/**
 * The app role ({service}_app) a local service connects as, and its URL
 * (the service's DATABASE_URL). Its password lives only in that URL: an
 * existing DATABASE_URL of the app role keeps it; anything else (no URL yet,
 * or the owner's URL from before the app role existed) gets a new one.
 *
 * @param serviceName - Service name (e.g., "auth-service"), also the database
 * @param dbPort - Local database port
 * @param existingUrl - The service's current DATABASE_URL in .secrets.tsdevstack.json
 * @returns The app role's name, password and URL
 */
export function generateDatabaseAppSecrets(
  serviceName: string,
  dbPort: number,
  existingUrl?: unknown,
): { username: string; password: string; url: string } {
  const username = buildDatabaseAppRole(serviceName);

  let password: string | undefined;
  if (typeof existingUrl === 'string') {
    try {
      const existing = parsePostgresUrl(existingUrl);
      if (existing.user === username) {
        password = existing.password;
      }
    } catch {
      // Not a database URL: make a new password
    }
  }
  password ??= generateBase64Secret(32);

  return {
    username,
    password,
    url: `postgresql://${username}:${encodeURIComponent(password)}@localhost:${dbPort}/${serviceName}`,
  };
}
