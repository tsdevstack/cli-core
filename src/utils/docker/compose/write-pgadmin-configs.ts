/**
 * Write pgAdmin configuration files (servers.json and pgpass)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FrameworkService } from '../../config';
import type { PgAdminServers } from '../types';
import { writeJsonFile } from '../../fs';

export function writePgAdminConfigs(
  rootDir: string,
  services: FrameworkService[],
  secrets: Record<string, string>,
): void {
  // Generate pgAdmin servers.json
  const servers: PgAdminServers = {};
  let serverIndex = 1;

  for (const service of services) {
    if (service.hasDatabase) {
      const dbName = service.name.replace(/-service$/, '');
      const prefix = dbName.replace(/-/g, '_').toUpperCase();
      const username = secrets[`${prefix}_DB_USER`] || service.name;

      servers[`Server ${serverIndex}`] = {
        Name: `${dbName} (local)`,
        Group: 'Development',
        Host: `${dbName}-db`,
        Port: 5432,
        MaintenanceDB: service.name,
        Username: username,
        SSLMode: 'prefer',
      };
      serverIndex++;
    }
  }

  const serversJson = { Servers: servers };
  writeJsonFile(path.join(rootDir, 'pgadmin-servers.json'), serversJson);

  // Generate pgAdmin pgpass file for auto-login
  const pgpassLines: string[] = [];
  for (const service of services) {
    if (service.hasDatabase) {
      const dbName = service.name.replace(/-service$/, '');
      const prefix = dbName.replace(/-/g, '_').toUpperCase();
      const username = secrets[`${prefix}_DB_USER`] || service.name;
      const password = secrets[`${prefix}_DB_PASSWORD`];

      // Format: hostname:port:database:username:password
      pgpassLines.push(
        `${dbName}-db:5432:${service.name}:${username}:${password}`,
      );
    }
  }

  fs.writeFileSync(
    path.join(rootDir, 'pgadmin-pgpass'),
    pgpassLines.join('\n') + '\n',
    'utf-8',
  );
  // Set proper permissions (only owner can read)
  fs.chmodSync(path.join(rootDir, 'pgadmin-pgpass'), 0o600);
}
