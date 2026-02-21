/**
 * Delete a file from the filesystem
 */

import fs from 'node:fs';

/**
 * Delete a file at the given path
 *
 * @param filePath - The path to the file to delete
 */
export function deleteFile(filePath: string): void {
  fs.unlinkSync(filePath);
}
