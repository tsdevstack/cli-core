/**
 * Check if a service has a Prisma schema file
 *
 * @param serviceName - Name of the service
 * @returns True if schema.prisma exists for the service
 */

import { isFile } from '../fs';
import { getPrismaSchemaPath } from '../paths';

export function hasPrismaSchema(serviceName: string): boolean {
  const schemaPath = getPrismaSchemaPath(serviceName);
  return isFile(schemaPath);
}