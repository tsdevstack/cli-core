/**
 * Start a container as an attached child process
 */

import { spawn } from 'child_process';
import type { RunningContainer } from './types';

/**
 * Runs `docker run --rm --name <name> <args>` attached (no -d), so the
 * container never outlives the test process unnoticed. Output is collected
 * in `logs`. Stop it with stopAttachedContainer.
 */
export function startAttachedContainer(
  name: string,
  args: string[],
): RunningContainer {
  const logs: string[] = [];
  const child = spawn('docker', ['run', '--rm', '--name', name, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (chunk: Buffer) => logs.push(chunk.toString()));
  child.stderr?.on('data', (chunk: Buffer) => logs.push(chunk.toString()));
  return { name, child, logs };
}
