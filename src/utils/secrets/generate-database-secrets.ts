/**
 * Generate database-specific secrets
 */

import { validateServiceName } from '../validation/validate-service-name';
import { generateBase64Secret } from './generate-base64-secret';

/**
 * Generate database-specific secrets
 * Generates secure random credentials if not provided (preserves existing ones)
 *
 * @param serviceName - Service name (e.g., "auth-service")
 * @param dbPort - Database port
 * @param existingUsername - Existing database username (preserves it)
 * @param existingPassword - Existing database password (preserves it)
 * @returns Object with database credentials
 * @throws CliError if serviceName is invalid
 */
export function generateDatabaseSecrets(
  serviceName: string,
  dbPort: number,
  existingUsername?: string,
  existingPassword?: string,
): {
  password: string;
  username: string;
  database: string;
  url: string;
} {
  // Validate service name
  validateServiceName(serviceName);

  // Generate secure random credentials or use existing ones
  // Naming convention matches GCP/AWS: use full service name for both
  // Username: service name (e.g., "auth-service", "offers-service")
  const username = existingUsername || serviceName;
  // Password: 32-byte base64 secret (secure random)
  const password = existingPassword || generateBase64Secret(32);
  const database = serviceName;
  // Use localhost for local development (apps run outside Docker, DBs inside)
  const host = 'localhost';

  return {
    password,
    username,
    database,
    // URL-encode the password to handle special characters (+, /, =) in base64
    url: `postgresql://${username}:${encodeURIComponent(password)}@${host}:${dbPort}/${database}`,
  };
}
