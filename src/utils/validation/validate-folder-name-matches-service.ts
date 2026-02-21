/**
 * Validate folder name matches service name
 *
 * Checks: service folder in apps/ directory has correct name
 *
 * @throws {CliError} if folder name doesn't match
 */

import * as path from 'path';
import { CliError } from '../errors';
import { getServicePath } from '../paths/index';

export function validateFolderNameMatchesService(serviceName: string): void {
  const serviceDir = getServicePath(serviceName);
  const folderName = path.basename(serviceDir);

  if (folderName !== serviceName) {
    throw new CliError(
      `Folder name "${folderName}" does not match service name "${serviceName}"`,
      'Folder name mismatch',
      `Rename the folder to "${serviceName}" or update the service name to "${folderName}"`
    );
  }
}