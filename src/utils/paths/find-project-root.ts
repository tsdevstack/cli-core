/**
 * Project root detection utilities
 *
 * Finds the project root directory by looking for .tsdevstack folder.
 * This makes the CLI work from any subdirectory within the project.
 */

import * as path from 'path';
import { CliError } from '../errors';
import { isDirectory } from '../fs';
import { TSDEVSTACK_DIR } from '../../constants';

/**
 * Find the project root by walking up the directory tree
 *
 * Looks for .tsdevstack/ directory which is always present in tsdevstack projects.
 *
 * @param startDir - Directory to start searching from (defaults to cwd)
 * @param maxDepth - Maximum number of parent directories to search (default: 10)
 * @returns Project root path
 * @throws CliError if project root cannot be found
 */
export function findProjectRoot(startDir: string = process.cwd(), maxDepth: number = 10): string {
  let currentDir = path.resolve(startDir);
  let depth = 0;

  while (depth < maxDepth) {
    const tsdevstackDir = path.join(currentDir, TSDEVSTACK_DIR);

    if (isDirectory(tsdevstackDir)) {
      return currentDir;
    }

    // Move up one directory
    const parentDir = path.dirname(currentDir);

    // Check if we've reached the filesystem root
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
    depth++;
  }

  throw new CliError(
    `Searched up to ${depth} parent directories from: ${startDir}\nLooking for ${TSDEVSTACK_DIR}/ directory.`,
    'Could not find tsdevstack project root',
    'Please run this command from within your tsdevstack project.'
  );
}
