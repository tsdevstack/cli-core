/**
 * Get the database service name for a given service
 *
 * Service names in docker-compose follow the pattern: "auth-db", "demo-db", etc.
 * This removes "-service" suffix and adds "-db" suffix.
 *
 * @param serviceName - The service name (e.g., "auth-service", "demo-service")
 * @returns The database service name (e.g., "auth-db", "demo-db")
 */
export function getDbServiceName(serviceName: string): string {
  return serviceName.replace('-service', '') + '-db';
}