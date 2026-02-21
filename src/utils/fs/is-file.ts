/**
 * Check if a path exists and is a file
 *
 * @param filePath - Path to check
 * @returns true if path exists and is a file
 */

import * as fs from 'fs';

export function isFile(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}