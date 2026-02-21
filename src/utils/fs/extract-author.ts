/**
 * Extract author name from package.json
 */

import type { PackageJson } from './package-json-types';

/**
 * Extract author name from package.json author field
 *
 * @param packageJson - Parsed package.json
 * @returns Author name or 'unknown' if not found
 */
export function extractAuthor(packageJson: PackageJson): string {
  if (!packageJson.author) {
    return 'unknown';
  }

  if (typeof packageJson.author === 'string') {
    return packageJson.author;
  }

  return packageJson.author.name || 'unknown';
}