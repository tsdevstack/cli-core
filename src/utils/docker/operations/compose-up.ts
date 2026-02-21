/**
 * Bring up all containers defined in docker-compose.yml
 */

import { execSync } from 'child_process';

/**
 * Bring up all containers defined in docker-compose.yml
 *
 * @param rootDir - Project root directory
 * @param detached - Whether to run in detached mode (-d flag, default: true)
 * @param wait - Whether to wait for containers to be healthy (--wait flag, default: true when detached)
 * @param removeOrphans - Whether to remove orphaned containers (--remove-orphans flag, default: false)
 * @param build - Whether to build images before starting (--build flag, default: true)
 */
export function composeUp(
  rootDir: string = process.cwd(),
  detached: boolean = true,
  wait: boolean = true,
  removeOrphans: boolean = false,
  build: boolean = true
): void {
  let args = 'docker compose up';

  if (build) {
    args += ' --build';
  }

  if (detached) {
    args += ' -d';
    if (wait) {
      args += ' --wait';
    }
  }

  if (removeOrphans) {
    args += ' --remove-orphans';
  }

  execSync(args, { cwd: rootDir, stdio: 'inherit' });
}