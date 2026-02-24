/**
 * Remove template-specific metadata from a cloned template's package.json
 *
 * Strips repository, homepage, and bugs fields that point back to the
 * template repo and should not be carried into the user's project.
 *
 * @param appPath - Absolute path to the cloned app directory
 */

import { readPackageJsonFrom, writePackageJson } from '../fs';
import { logger } from '../logger';

export function removeTemplateMetadata(appPath: string): void {
  try {
    const packageJson = readPackageJsonFrom(appPath);
    delete (packageJson as Record<string, unknown>).repository;
    delete (packageJson as Record<string, unknown>).homepage;
    delete (packageJson as Record<string, unknown>).bugs;
    writePackageJson(appPath, packageJson);
  } catch {
    logger.warn('Could not remove template metadata from package.json');
  }
}
