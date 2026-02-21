import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockExecSync } = rs.hoisted(() => ({
  mockExecSync: rs.fn(),
}));

rs.mock('child_process', () => ({
  execSync: mockExecSync,
}));

import { composeUp } from './compose-up';

describe('composeUp', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Default behavior', () => {
    it('should run docker compose up with --build -d --wait by default', () => {
      composeUp('/project');

      expect(mockExecSync).toHaveBeenCalledWith(
        'docker compose up --build -d --wait',
        { cwd: '/project', stdio: 'inherit' },
      );
    });

    it('should default rootDir to process.cwd()', () => {
      composeUp();

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ cwd: process.cwd() }),
      );
    });
  });

  describe('Flag combinations', () => {
    it('should omit --build when build is false', () => {
      composeUp('/project', true, true, false, false);

      const command = mockExecSync.mock.calls[0][0] as string;
      expect(command).not.toContain('--build');
    });

    it('should omit -d and --wait when detached is false', () => {
      composeUp('/project', false);

      const command = mockExecSync.mock.calls[0][0] as string;
      expect(command).not.toContain('-d');
      expect(command).not.toContain('--wait');
    });

    it('should omit --wait when wait is false but detached is true', () => {
      composeUp('/project', true, false);

      const command = mockExecSync.mock.calls[0][0] as string;
      expect(command).toContain('-d');
      expect(command).not.toContain('--wait');
    });

    it('should include --remove-orphans when removeOrphans is true', () => {
      composeUp('/project', true, true, true);

      const command = mockExecSync.mock.calls[0][0] as string;
      expect(command).toContain('--remove-orphans');
    });

    it('should not include --remove-orphans by default', () => {
      composeUp('/project');

      const command = mockExecSync.mock.calls[0][0] as string;
      expect(command).not.toContain('--remove-orphans');
    });
  });
});
