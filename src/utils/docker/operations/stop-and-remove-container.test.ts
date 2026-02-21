import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockExecSync } = rs.hoisted(() => ({
  mockExecSync: rs.fn(),
}));

rs.mock('child_process', () => ({
  execSync: mockExecSync,
}));

import { stopAndRemoveContainer } from './stop-and-remove-container';

describe('stopAndRemoveContainer', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should run docker rm -f with the container name', () => {
    stopAndRemoveContainer('project-auth-db-1');

    expect(mockExecSync).toHaveBeenCalledWith(
      'docker rm -f project-auth-db-1',
      { stdio: 'ignore' },
    );
  });

  it('should return true when container is removed', () => {
    const result = stopAndRemoveContainer('project-auth-db-1');

    expect(result).toBe(true);
  });

  it('should return false when container does not exist', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('no such container');
    });

    const result = stopAndRemoveContainer('nonexistent');

    expect(result).toBe(false);
  });
});
