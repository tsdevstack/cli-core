import { describe, it, expect, beforeAll } from '@rstest/core';
import { spawnSync } from 'child_process';
import { isStaleDockerTestResource } from './is-stale-docker-test-resource';

describe('isStaleDockerTestResource', () => {
  const base = 'tsds-kong-e2e';
  let exitedPid: number;

  beforeAll(() => {
    // A process that has already exited
    exitedPid = spawnSync(process.execPath, ['-e', '']).pid;
  });

  describe('Standard use cases', () => {
    it('should flag a resource of a run whose process has exited', () => {
      expect(
        isStaleDockerTestResource(`${base}-${exitedPid}-1a2b3c4d-net`, base),
      ).toBe(true);
    });

    it('should keep a resource of a run still in progress', () => {
      expect(
        isStaleDockerTestResource(`${base}-${process.pid}-1a2b3c4d-net`, base),
      ).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should keep names of another base', () => {
      expect(
        isStaleDockerTestResource(
          `tsds-apikey-e2e-${exitedPid}-1a2b3c4d`,
          base,
        ),
      ).toBe(false);
    });

    it('should keep names without a process id', () => {
      expect(isStaleDockerTestResource(`${base}-1a2b3c4d-net`, base)).toBe(
        false,
      );
      expect(isStaleDockerTestResource(base, base)).toBe(false);
    });
  });
});
