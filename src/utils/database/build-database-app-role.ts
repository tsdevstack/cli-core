/**
 * Name a service's app role
 */

import { DATABASE_APP_ROLE_SUFFIX } from '../../constants';

/**
 * The Postgres role a running service connects as: reads and writes rows,
 * no schema changes. The owner role has the service's name.
 *
 * @param serviceName - Service name (e.g., "auth-service")
 * @returns App role name (e.g., "auth-service_app")
 */
export function buildDatabaseAppRole(serviceName: string): string {
  return `${serviceName}${DATABASE_APP_ROLE_SUFFIX}`;
}
