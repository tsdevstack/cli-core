/**
 * Stop a container started with startAttachedContainer
 */

import { spawnSync } from 'child_process';
import type { RunningContainer } from './types';
import { sleep } from './sleep';

/**
 * Removes the container (`docker rm -f`) and waits up to 10 seconds for the
 * attached `docker run` process to exit, then kills it. Safe to call when the
 * container was never started.
 */
export async function stopAttachedContainer(
  name: string,
  running: RunningContainer | undefined,
): Promise<void> {
  spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
  if (running && running.child.exitCode === null) {
    await Promise.race([
      new Promise((resolve) => running.child.once('exit', resolve)),
      sleep(10_000),
    ]);
    running.child.kill();
  }
}
