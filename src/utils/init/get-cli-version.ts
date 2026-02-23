/**
 * Get the current CLI version from package.json
 *
 * Uses import.meta.url to resolve the package.json path relative to this file,
 * same pattern as cli.ts.
 *
 * @returns The CLI version string (e.g., "0.1.4")
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export function getCliVersion(): string {
  const currentFilename = fileURLToPath(import.meta.url);
  const currentDirname = dirname(currentFilename);
  // From src/utils/init/ or dist/utils/init/ → 3 levels up to package root
  const packageJsonPath = join(currentDirname, '../../../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
    version: string;
  };
  return packageJson.version;
}
