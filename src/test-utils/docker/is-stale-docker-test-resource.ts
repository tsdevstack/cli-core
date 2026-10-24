/**
 * Is Stale Docker Test Resource
 *
 * Tells whether a resource named by buildDockerTestPrefix(base) belongs to a
 * test run whose process has exited, i.e. a run killed before its afterAll.
 * Resources of a run still in progress, and names in any other format, are
 * never stale.
 */

export function isStaleDockerTestResource(name: string, base: string): boolean {
  if (!name.startsWith(`${base}-`)) {
    return false;
  }

  const pid = name.slice(base.length + 1).split('-')[0];
  if (!/^\d+$/.test(pid)) {
    return false;
  }

  try {
    // Signal 0 only checks that the process exists
    process.kill(Number(pid), 0);
    return false;
  } catch (error) {
    // EPERM: the process exists but belongs to another user
    return (error as NodeJS.ErrnoException).code === 'ESRCH';
  }
}
