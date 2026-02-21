/**
 * Read package.json from a specific directory
 */

import * as path from 'path';
import { readJsonFile } from './read-json-file';
import type { PackageJson } from './package-json-types';

/**
 * Read and parse package.json from a specific directory
 *
 * @param dirPath - Directory containing package.json
 * @returns Parsed package.json
 * @throws CliError if package.json not found or invalid
 */
export function readPackageJsonFrom(dirPath: string): PackageJson {
  const packageJsonPath = path.join(dirPath, 'package.json');
  return readJsonFile<PackageJson>(packageJsonPath);
}