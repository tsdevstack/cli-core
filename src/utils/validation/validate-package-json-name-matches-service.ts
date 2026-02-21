/**
 * Validate package.json name matches service name
 *
 * Checks: package.json.name equals serviceName
 *
 * @throws {CliError} if package.json name doesn't match
 */

import { CliError } from '../errors';
import { getServicePath } from '../paths/index';
import { readPackageJsonFrom } from '../fs/index';

export function validatePackageJsonNameMatchesService(serviceName: string): void {
  const serviceDir = getServicePath(serviceName);
  const pkg = readPackageJsonFrom(serviceDir);

  if (pkg.name !== serviceName) {
    throw new CliError(
      `Package name mismatch:\n` +
        `  Folder name:       "${serviceName}"\n` +
        `  package.json name: "${pkg.name}"`,
      'Package name mismatch',
      'Update package.json name to match the folder name, or rename the folder'
    );
  }
}