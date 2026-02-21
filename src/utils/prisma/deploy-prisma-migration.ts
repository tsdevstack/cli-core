/**
 * Deploy pending Prisma migrations for a service
 *
 * Runs: prisma migrate deploy
 *
 * @param serviceName - Name of the service
 * @param databaseUrl - Database connection URL (with localhost)
 */

import { executeCommand } from '../exec';
import { getServicePath } from '../paths';

export function deployPrismaMigration(serviceName: string, databaseUrl: string): void {
  const servicePath = getServicePath(serviceName);

  executeCommand(`DATABASE_URL="${databaseUrl}" npx prisma migrate deploy`, {
    cwd: servicePath,
  });
}