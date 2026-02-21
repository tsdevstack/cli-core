/**
 * Bring down all containers defined in docker-compose.yml
 */

import { execSync } from 'child_process';

/**
 * Bring down all containers defined in docker-compose.yml
 *
 * @param rootDir - Project root directory
 * @param removeVolumes - Whether to remove volumes (-v flag)
 */
export function composeDown(rootDir: string = process.cwd(), removeVolumes: boolean = false): void {
  // Always use --remove-orphans to clean up renamed containers
  const volumeFlag = removeVolumes ? '-v' : '';
  const args = `docker compose down --remove-orphans ${volumeFlag}`.trim();
  execSync(args, { cwd: rootDir, stdio: 'inherit' });
}