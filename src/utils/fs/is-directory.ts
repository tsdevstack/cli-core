/**
 * Check if a path exists and is a directory
 *
 * @param dirPath - Path to check
 * @returns true if path exists and is a directory
 */

import * as fs from 'fs';

export function isDirectory(dirPath: string): boolean {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}