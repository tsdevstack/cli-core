import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockSpawnSync } = rs.hoisted(() => ({
  mockSpawnSync: rs.fn(),
}));

rs.mock('child_process', () => ({
  spawnSync: mockSpawnSync,
}));

import { remoteTagExists } from './remote-tag-exists';
import { CliError } from '../errors';

function spawnResult(
  status: number | null,
  stderr = '',
  error?: Error,
): Record<string, unknown> {
  return {
    status,
    stdout: Buffer.from(''),
    stderr: Buffer.from(stderr),
    pid: 1234,
    output: [],
    signal: null,
    error,
  };
}

describe('remoteTagExists', () => {
  const REPO_URL = 'https://github.com/tsdevstack/some-template.git';

  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should query the exact tag ref with --exit-code', () => {
      mockSpawnSync.mockReturnValue(spawnResult(0));

      remoteTagExists(REPO_URL, 'v0.7.0');

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['ls-remote', '--exit-code', '--tags', REPO_URL, 'refs/tags/v0.7.0'],
        { stdio: 'pipe' },
      );
    });

    it('should return true when ls-remote exits with 0', () => {
      mockSpawnSync.mockReturnValue(spawnResult(0));

      expect(remoteTagExists(REPO_URL, 'v0.7.0')).toBe(true);
    });

    it('should return false when ls-remote exits with 2 (no matching ref)', () => {
      mockSpawnSync.mockReturnValue(spawnResult(2));

      expect(remoteTagExists(REPO_URL, 'v0.7.0')).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should throw CliError with stderr when the remote cannot be read', () => {
      mockSpawnSync.mockReturnValue(
        spawnResult(128, 'fatal: repository not found'),
      );

      try {
        remoteTagExists(REPO_URL, 'v0.7.0');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('fatal: repository not found');
        expect(cliError.context).toBe('Template clone failed');
      }
    });

    it('should throw CliError when git cannot be spawned', () => {
      mockSpawnSync.mockReturnValue(
        spawnResult(null, '', new Error('spawn git ENOENT')),
      );

      expect(() => remoteTagExists(REPO_URL, 'v0.7.0')).toThrow(
        'spawn git ENOENT',
      );
    });
  });
});
