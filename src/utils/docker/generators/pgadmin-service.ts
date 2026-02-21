/**
 * Generate pgAdmin service configuration with all databases pre-configured
 */

import type { FrameworkService } from '../../config';
import type { DockerComposeServices, PgAdminServers } from '../types';
import { getDbServiceName } from '../get-db-service-name';

export function generatePgAdminService(
  services: FrameworkService[],
  secrets: Record<string, string>,
  networkName: string,
): DockerComposeServices {
  // Build servers.json for pgAdmin with all databases
  const servers: PgAdminServers = {};

  let serverIndex = 1;
  for (const service of services) {
    if (service.hasDatabase) {
      const dbName = service.name.replace(/-service$/, '');
      const dbServiceName = getDbServiceName(service.name);
      const prefix = dbName.replace(/-/g, '_').toUpperCase();
      const username = secrets[`${prefix}_DB_USER`] || service.name;

      servers[`Server ${serverIndex}`] = {
        Name: `${dbName} (local)`,
        Group: 'Development',
        Host: dbServiceName,
        Port: 5432,
        MaintenanceDB: service.name,
        Username: username,
        SSLMode: 'prefer',
      };
      serverIndex++;
    }
  }

  return {
    pgadmin: {
      image: 'dpage/pgadmin4:latest',
      restart: 'always',
      environment: {
        PGADMIN_DEFAULT_EMAIL: 'admin@localhost.com',
        PGADMIN_DEFAULT_PASSWORD: 'admin',
        PGADMIN_CONFIG_SERVER_MODE: 'False',
        PGADMIN_CONFIG_MASTER_PASSWORD_REQUIRED: 'False',
      },
      volumes: [
        './data/pgadmin:/var/lib/pgadmin',
        // Pre-configure servers
        {
          type: 'bind',
          source: './pgadmin-servers.json',
          target: '/pgadmin4/servers.json',
          read_only: true,
        },
        // Pre-configure passwords
        {
          type: 'bind',
          source: './pgadmin-pgpass',
          target: '/var/lib/pgadmin/storage/admin_localhost.com/pgpass',
          read_only: true,
        },
      ],
      ports: ['5050:80'],
      networks: [networkName],
      depends_on: services
        .filter((s) => s.hasDatabase)
        .map((s) => getDbServiceName(s.name)),
    },
  };
}
