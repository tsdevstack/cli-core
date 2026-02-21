/**
 * Reset pgAdmin data directory
 */

import * as path from 'path';
import { deleteFolderRecursive } from '../../fs';

/**
 * Reset pgAdmin data directory
 * This clears server configurations so pgAdmin can be reconfigured
 *
 * @param rootDir - Project root directory
 * @returns true if directory was removed, false if it didn't exist
 */
export function resetPgAdminData(rootDir: string = process.cwd()): boolean {
  const pgAdminDataPath = path.join(rootDir, 'data', 'pgadmin');

  try {
    deleteFolderRecursive(pgAdminDataPath);
    return true;
  } catch {
    // Directory doesn't exist or couldn't be deleted
    return false;
  }
}