/**
 * Validate service package.json exists
 *
 * Checks: apps/{serviceName}/package.json exists
 *
 * @throws {CliError} if package.json not found
 */

import * as fs from 'fs';
import { CliError } from '../errors';
import { getServicePackageJsonPath } from '../paths/index';

export function validateServicePackageJsonExists(serviceName: string): void {
  const pkgPath = getServicePackageJsonPath(serviceName);

  if (!fs.existsSync(pkgPath)) {
    throw new CliError(
      `package.json not found: ${pkgPath}`,
      'Missing package.json',
      'Ensure the service has a package.json file'
    );
  }
}