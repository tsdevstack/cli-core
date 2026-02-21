/**
 * Read package.json from current working directory
 */

import * as path from 'path';
import { readJsonFile } from './read-json-file';
import type { PackageJson } from './package-json-types';

/**
 * Read and parse package.json from current working directory
 *
 * @returns Parsed package.json
 * @throws CliError if package.json not found or invalid
 */
export function readPackageJson(): PackageJson {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  return readJsonFile<PackageJson>(packageJsonPath);
}