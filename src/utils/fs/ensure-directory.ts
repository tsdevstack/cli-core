/**
 * Ensure a directory exists, creating it recursively if needed
 *
 * @param dirPath - Path to directory
 * @throws CliError if directory creation fails
 */

import * as fs from 'fs';
import { CliError } from '../errors';

export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (error) {
      throw new CliError(
        `Failed to create directory: ${dirPath}\n${error instanceof Error ? error.message : error}`,
        'Directory creation failed',
        'Ensure you have write permissions for the parent directory'
      );
    }
  }
}