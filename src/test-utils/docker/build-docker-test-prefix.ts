/**
 * Build Docker Test Prefix
 *
 * Names a test run's Docker resources `<base>-<pid>-<random>`. The process id
 * lets a later run tell the leftovers of a killed run (process gone) from the
 * resources of a run still in progress; see removeStaleDockerResources.
 */

import { randomBytes } from 'crypto';

export function buildDockerTestPrefix(base: string): string {
  return `${base}-${process.pid}-${randomBytes(4).toString('hex')}`;
}
