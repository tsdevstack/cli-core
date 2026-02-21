/**
 * Recreate all Docker containers (down + up)
 */

import { composeDown } from './compose-down';
import { composeUp } from './compose-up';

/**
 * Recreate all Docker containers (down + up)
 *
 * @param rootDir - Project root directory
 */
export function recreateAllContainers(rootDir: string = process.cwd()): void {
  console.log(`   Recreating all containers...`);
  composeDown(rootDir);
  composeUp(rootDir);
}