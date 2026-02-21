/**
 * Generate PostgreSQL database service configuration
 */

import type { DockerComposeServices } from '../types';
import { getDbServiceName } from '../get-db-service-name';

export function generateDatabaseService(
  serviceName: string,
  port: number,
  networkName: string,
): DockerComposeServices {
  const containerName = getDbServiceName(serviceName);
  // Env var prefix: auth-service → AUTH (strip -service, uppercase, hyphens to underscores)
  const prefix = serviceName
    .replace(/-service$/, '')
    .replace(/-/g, '_')
    .toUpperCase();

  return {
    [containerName]: {
      image: 'postgres:16',
      environment: {
        // Database name matches service name (aligned with GCP/AWS)
        POSTGRES_DB: serviceName,
        POSTGRES_USER: `\${${prefix}_DB_USER}`,
        POSTGRES_PASSWORD: `\${${prefix}_DB_PASSWORD}`,
      },
      volumes: [`./data/${containerName}:/var/lib/postgresql/data`],
      ports: [`${port}:5432`],
      networks: [networkName],
    },
  };
}
