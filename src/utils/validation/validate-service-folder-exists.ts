/**
 * Validate service folder exists
 *
 * Checks: apps/{serviceName}/ folder exists
 *
 * @throws {CliError} if folder not found
 */

import * as fs from 'fs';
import { CliError } from '../errors';
import { getServicePath } from '../paths/index';

export function validateServiceFolderExists(serviceName: string): void {
  const servicePath = getServicePath(serviceName);

  if (!fs.existsSync(servicePath)) {
    throw new CliError(
      `Service folder not found: ${servicePath}`,
      'Service folder missing',
      'Ensure the service folder exists in the apps/ directory'
    );
  }
}