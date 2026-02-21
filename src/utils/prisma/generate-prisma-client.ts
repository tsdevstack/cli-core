/**
 * Generate Prisma client for a service
 *
 * Runs: prisma generate
 *
 * @param serviceName - Name of the service
 * @param databaseUrl - Database connection URL (with localhost)
 */

import { executeCommand } from '../exec';
import { getServicePath } from '../paths';

export function generatePrismaClient(serviceName: string, databaseUrl: string): void {
  const servicePath = getServicePath(serviceName);

  executeCommand(`DATABASE_URL="${databaseUrl}" npx prisma generate`, {
    cwd: servicePath,
  });
}