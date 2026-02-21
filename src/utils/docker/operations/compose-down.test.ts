import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockExecSync } = rs.hoisted(() => ({
  mockExecSync: rs.fn(),
}));

rs.mock('child_process', () => ({
  execSync: mockExecSync,
}));

import { composeDown } from './compose-down';

describe('composeDown', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should run docker compose down with --remove-orphans', () => {
    composeDown('/project');

    expect(mockExecSync).toHaveBeenCalledWith(
      'docker compose down --remove-orphans',
      { cwd: '/project', stdio: 'inherit' },
    );
  });

  it('should include -v flag when removeVolumes is true', () => {
    composeDown('/project', true);

    expect(mockExecSync).toHaveBeenCalledWith(
      'docker compose down --remove-orphans -v',
      { cwd: '/project', stdio: 'inherit' },
    );
  });

  it('should default rootDir to process.cwd()', () => {
    composeDown();

    expect(mockExecSync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cwd: process.cwd() }),
    );
  });

  it('should default removeVolumes to false', () => {
    composeDown('/project');

    const command = mockExecSync.mock.calls[0][0] as string;
    expect(command).not.toContain('-v');
  });
});
