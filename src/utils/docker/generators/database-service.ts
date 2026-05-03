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
      // `$$` is the compose escape — compose renders it as `$`, the in-container
      // shell expands `$POSTGRES_USER`/`$POSTGRES_DB` from the container's env.
      // Without this healthcheck, `docker compose up --wait` returns as soon as
      // the container process exists, before initdb finishes — which lets prisma
      // migrate fire against a not-yet-ready DB on first run.
      healthcheck: {
        test: ['CMD-SHELL', 'pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB'],
        interval: '5s',
        timeout: '3s',
        retries: 10,
        start_period: '15s',
      },
    },
  };
}
