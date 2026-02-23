import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockSpawnSync, mockExistsSync, mockDeleteFolderRecursive, mockLogger } =
  rs.hoisted(() => ({
    mockSpawnSync: rs.fn(),
    mockExistsSync: rs.fn(),
    mockDeleteFolderRecursive: rs.fn(),
    mockLogger: {
      success: rs.fn(),
    },
  }));

rs.mock('child_process', () => ({
  spawnSync: mockSpawnSync,
}));
rs.mock('fs', () => ({
  existsSync: mockExistsSync,
}));
rs.mock('../fs', () => ({
  deleteFolderRecursive: mockDeleteFolderRecursive,
}));
rs.mock('../logger', () => ({
  logger: mockLogger,
}));

import { cloneTemplateRepo } from './clone-template-repo';
import { CliError } from '../errors';

describe('cloneTemplateRepo', () => {
  const REPO_URL = 'https://github.com/tsdevstack/some-template.git';
  const TARGET_PATH = '/fake/project/apps/my-service';

  beforeEach(() => {
    rs.clearAllMocks();

    // Default: clone succeeds, .git exists
    mockSpawnSync.mockReturnValue({
      status: 0,
      stdout: Buffer.from(''),
      stderr: Buffer.from(''),
      pid: 1234,
      output: [],
      signal: null,
    });
    mockExistsSync.mockReturnValue(true);
  });

  describe('Standard use cases', () => {
    it('should clone with --depth 1', () => {
      cloneTemplateRepo(REPO_URL, TARGET_PATH);

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', REPO_URL, TARGET_PATH],
        { stdio: 'pipe' },
      );
    });

    it('should remove .git directory after successful clone', () => {
      cloneTemplateRepo(REPO_URL, TARGET_PATH);

      expect(mockDeleteFolderRecursive).toHaveBeenCalledWith(
        `${TARGET_PATH}/.git`,
      );
    });

    it('should log success after cloning', () => {
      cloneTemplateRepo(REPO_URL, TARGET_PATH);

      expect(mockLogger.success).toHaveBeenCalledWith('Template cloned');
    });
  });

  describe('Edge cases', () => {
    it('should skip .git removal when .git directory does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      cloneTemplateRepo(REPO_URL, TARGET_PATH);

      expect(mockDeleteFolderRecursive).not.toHaveBeenCalled();
    });

    it('should throw CliError when clone fails', () => {
      mockSpawnSync.mockReturnValue({
        status: 1,
        stdout: Buffer.from(''),
        stderr: Buffer.from('fatal: repository not found'),
        pid: 1234,
        output: [],
        signal: null,
      });

      expect(() => cloneTemplateRepo(REPO_URL, TARGET_PATH)).toThrow(CliError);
    });

    it('should include stderr in error message', () => {
      mockSpawnSync.mockReturnValue({
        status: 1,
        stdout: Buffer.from(''),
        stderr: Buffer.from('fatal: repository not found'),
        pid: 1234,
        output: [],
        signal: null,
      });

      try {
        cloneTemplateRepo(REPO_URL, TARGET_PATH);
        expect.fail('Should have thrown');
      } catch (error) {
        const cliError = error as CliError;
        expect(cliError.message).toContain('fatal: repository not found');
        expect(cliError.context).toBe('Template clone failed');
      }
    });

    it('should not remove .git when clone fails', () => {
      mockSpawnSync.mockReturnValue({
        status: 1,
        stdout: Buffer.from(''),
        stderr: Buffer.from('error'),
        pid: 1234,
        output: [],
        signal: null,
      });

      try {
        cloneTemplateRepo(REPO_URL, TARGET_PATH);
      } catch {
        // expected
      }

      expect(mockDeleteFolderRecursive).not.toHaveBeenCalled();
    });
  });
});
