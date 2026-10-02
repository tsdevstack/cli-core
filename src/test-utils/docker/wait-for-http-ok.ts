/**
 * Wait until a container answers an HTTP URL with a 2xx status
 */

import type { RunningContainer } from './types';
import { sleep } from './sleep';

/**
 * Polls `url` every second.
 *
 * @throws Error with the container logs when the container exits or the URL
 *   does not answer 2xx within `timeoutMs`
 */
export async function waitForHttpOk(
  url: string,
  running: RunningContainer,
  timeoutMs = 90_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (running.child.exitCode !== null) {
      throw new Error(
        `${running.name} exited (${running.child.exitCode}):\n${running.logs.join('')}`,
      );
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await sleep(1000);
  }
  throw new Error(
    `${running.name} not ready at ${url}:\n${running.logs.join('').slice(-4000)}`,
  );
}
