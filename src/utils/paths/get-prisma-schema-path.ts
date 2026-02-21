/**
 * Get path to Prisma schema file for a service
 *
 * @param serviceName - Name of the service
 * @param root - Project root directory (defaults to findProjectRoot())
 * @returns Absolute path to prisma/schema.prisma
 */

import * as path from 'path';
import { findProjectRoot } from './find-project-root';
import { getServicePath } from './get-service-path';

export function getPrismaSchemaPath(
  serviceName: string,
  root: string = findProjectRoot()
): string {
  return path.join(getServicePath(serviceName, root), 'prisma', 'schema.prisma');
}