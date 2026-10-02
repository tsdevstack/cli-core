/**
 * Check whether the Docker daemon is reachable
 */

import { spawnSync } from 'child_process';

/**
 * @returns true when `docker info` succeeds within 20 seconds
 */
export function isDockerAvailable(): boolean {
  return (
    spawnSync('docker', ['info'], { stdio: 'ignore', timeout: 20_000 })
      .status === 0
  );
}
