import { describe, it, expect } from '@rstest/core';
import { buildDockerTestPrefix } from './build-docker-test-prefix';

describe('buildDockerTestPrefix', () => {
  it('should name resources <base>-<pid>-<random>', () => {
    expect(buildDockerTestPrefix('tsds-kong-e2e')).toMatch(
      new RegExp(`^tsds-kong-e2e-${process.pid}-[0-9a-f]{8}$`),
    );
  });

  it('should differ between calls in one process', () => {
    expect(buildDockerTestPrefix('tsds-kong-e2e')).not.toBe(
      buildDockerTestPrefix('tsds-kong-e2e'),
    );
  });
});
