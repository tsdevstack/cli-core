/**
 * Get the current CLI version from package.json
 *
 * Rslib bundles all source into dist/cli.js, so import.meta.url always
 * resolves to dist/cli.js at runtime. We go 1 level up — same as cli.ts.
 *
 * @returns The CLI version string (e.g., "0.1.4")
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export function getCliVersion(): string {
  const currentFilename = fileURLToPath(import.meta.url);
  const currentDirname = dirname(currentFilename);
  // Bundled into dist/cli.js → 1 level up to package root
  const packageJsonPath = join(currentDirname, '../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
    version: string;
  };
  return packageJson.version;
}
