/**
 * Recreate all Docker containers (down + up)
 */

import { composeDown } from './compose-down';
import { composeUp } from './compose-up';
import { logger } from '../../logger';

/**
 * Recreate all Docker containers (down + up)
 *
 * @param rootDir - Project root directory
 */
export function recreateAllContainers(rootDir: string = process.cwd()): void {
  logger.info('Recreating all containers...');
  composeDown(rootDir);
  composeUp(rootDir);
}
