/**
 * Run a docker command and return its output
 */

import { spawnSync } from 'child_process';

/**
 * Runs `docker <args>` synchronously.
 *
 * @returns Trimmed stdout
 * @throws Error with stderr and stdout when docker exits non-zero
 */
export function runDocker(args: string[], timeout = 60_000): string {
  const result = spawnSync('docker', args, {
    encoding: 'utf-8',
    timeout,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      `docker ${args.join(' ')} failed (${result.status}):\n${result.stderr}\n${result.stdout}`,
    );
  }
  return result.stdout.trim();
}
