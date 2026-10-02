/**
 * Resolve the host port Docker published for a container port
 */

import { spawnSync } from 'child_process';
import { sleep } from './sleep';

/**
 * Polls `docker port` until the container publishes `containerPort`
 * (started with `-p 127.0.0.1::<port>`).
 *
 * @returns The host port
 * @throws Error when no port is published within `timeoutMs`
 */
export async function getContainerHostPort(
  name: string,
  containerPort: number,
  timeoutMs = 90_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = spawnSync('docker', ['port', name, `${containerPort}/tcp`], {
      encoding: 'utf-8',
    });
    const line = result.stdout.trim().split('\n')[0];
    if (result.status === 0 && line) {
      return line.slice(line.lastIndexOf(':') + 1);
    }
    await sleep(500);
  }
  throw new Error(`No host port for ${name}:${containerPort}`);
}
