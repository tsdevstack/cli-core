/**
 * Clean up a folder by deleting files and subdirectories except those specified
 *
 * @param folderPath - Path to folder to clean
 * @param entriesToKeep - Array of filenames/directory names to preserve
 * @throws CliError if path is not a directory or cleanup fails
 */

import * as fs from 'fs';
import * as path from 'path';
import { CliError } from '../errors';
import { isDirectory } from './is-directory';

export function cleanupFolder(
  folderPath: string,
  entriesToKeep: string[],
): void {
  // Validate input
  if (!isDirectory(folderPath)) {
    throw new CliError(
      `Path is not a directory: ${folderPath}`,
      'Folder cleanup failed',
      'cleanupFolder requires a directory path',
    );
  }

  try {
    const entries = fs.readdirSync(folderPath);
    const entriesToDelete = entries.filter(
      (entry) => !entriesToKeep.includes(entry),
    );

    for (const entry of entriesToDelete) {
      const entryPath = path.join(folderPath, entry);
      const stat = fs.statSync(entryPath);

      if (stat.isFile()) {
        fs.unlinkSync(entryPath);
      } else if (stat.isDirectory()) {
        fs.rmSync(entryPath, { recursive: true, force: true });
      }
    }
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(
      `Failed to clean up folder: ${folderPath}\n${error instanceof Error ? error.message : error}`,
      'Folder cleanup failed',
      'Ensure the folder exists and is writable',
    );
  }
}
