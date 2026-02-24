/**
 * Recursively remove .gitkeep files from a directory
 *
 * Template repos use .gitkeep to preserve empty directories in git.
 * After cloning, these files are no longer needed.
 *
 * @param dirPath - Absolute path to the directory to clean
 */

import * as fs from 'fs';
import { join } from 'path';

export function removeGitkeepFiles(dirPath: string): void {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      removeGitkeepFiles(fullPath);
    } else if (entry.name === '.gitkeep') {
      fs.unlinkSync(fullPath);
    }
  }
}
