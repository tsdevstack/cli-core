/**
 * Recursively delete a directory and its contents
 *
 * @param folderPath - Path to directory to delete
 * @throws CliError if path exists but is not a directory, or deletion fails
 */

import * as fs from 'fs';
import { CliError } from '../errors';
import { isDirectory } from './is-directory';

export function deleteFolderRecursive(folderPath: string): void {
  // If path doesn't exist, nothing to delete - return silently
  if (!fs.existsSync(folderPath)) {
    return;
  }

  // Validate that the path is a directory
  if (!isDirectory(folderPath)) {
    throw new CliError(
      `Path is not a directory: ${folderPath}`,
      'Folder deletion failed',
      'deleteFolderRecursive requires a directory path'
    );
  }

  try {
    fs.rmSync(folderPath, { recursive: true, force: true });
  } catch (error) {
    throw new CliError(
      `Failed to delete folder: ${folderPath}\n${error instanceof Error ? error.message : error}`,
      'Folder deletion failed',
      'Ensure the folder is not in use and you have write permissions'
    );
  }
}