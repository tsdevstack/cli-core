/**
 * Write package.json to disk
 */

import * as path from 'path';
import { writeJsonFile } from './write-json-file';
import type { PackageJson } from './package-json-types';

/**
 * Write package.json to disk with consistent formatting
 *
 * @param dirPath - Directory to write package.json
 * @param packageJson - Package.json content to write
 */
export function writePackageJson(
  dirPath: string,
  packageJson: PackageJson,
): void {
  const packageJsonPath = path.join(dirPath, 'package.json');
  writeJsonFile(packageJsonPath, packageJson);
}