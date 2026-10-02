import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const {
  mockSpawnSync,
  mockExistsSync,
  mockDeleteFolderRecursive,
  mockRemoveGitkeepFiles,
  mockGetCliVersion,
  mockRemoteTagExists,
  mockLogger,
} = rs.hoisted(() => ({
  mockSpawnSync: rs.fn(),
  mockExistsSync: rs.fn(),
  mockDeleteFolderRecursive: rs.fn(),
  mockRemoveGitkeepFiles: rs.fn(),
  mockGetCliVersion: rs.fn(),
  mockRemoteTagExists: rs.fn(),
  mockLogger: {
    success: rs.fn(),
    warn: rs.fn(),
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
rs.mock('./remove-gitkeep-files', () => ({
  removeGitkeepFiles: mockRemoveGitkeepFiles,
}));
rs.mock('../init/get-cli-version', () => ({
  getCliVersion: mockGetCliVersion,
}));
rs.mock('./remote-tag-exists', () => ({
  remoteTagExists: mockRemoteTagExists,
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
    mockGetCliVersion.mockReturnValue('0.7.0');
    mockRemoteTagExists.mockReturnValue(true);
  });

  describe('Standard use cases', () => {
    it('should look up the tag matching the CLI version', () => {
      cloneTemplateRepo(REPO_URL, TARGET_PATH);

      expect(mockRemoteTagExists).toHaveBeenCalledWith(REPO_URL, 'v0.7.0');
    });

    it('should shallow clone the version tag when it exists', () => {
      cloneTemplateRepo(REPO_URL, TARGET_PATH);

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', '--branch', 'v0.7.0', REPO_URL, TARGET_PATH],
        { stdio: 'pipe' },
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should fall back to the default branch with a warning when the tag does not exist', () => {
      mockRemoteTagExists.mockReturnValue(false);

      cloneTemplateRepo(REPO_URL, TARGET_PATH);

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', REPO_URL, TARGET_PATH],
        { stdio: 'pipe' },
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Template tag v0.7.0 not found'),
      );
      expect(mockLogger.success).toHaveBeenCalledWith('Template cloned');
    });

    it('should remove .git directory after successful clone', () => {
      cloneTemplateRepo(REPO_URL, TARGET_PATH);

      expect(mockDeleteFolderRecursive).toHaveBeenCalledWith(
        `${TARGET_PATH}/.git`,
      );
    });

    it('should log success after cloning', () => {
      cloneTemplateRepo(REPO_URL, TARGET_PATH);

      expect(mockLogger.success).toHaveBeenCalledWith(
        'Template cloned (v0.7.0)',
      );
    });
  });

  describe('Edge cases', () => {
    it('should not clone when the tag lookup fails', () => {
      mockRemoteTagExists.mockImplementation(() => {
        throw new CliError('lookup failed', 'Template clone failed');
      });

      expect(() => cloneTemplateRepo(REPO_URL, TARGET_PATH)).toThrow(
        'lookup failed',
      );
      expect(mockSpawnSync).not.toHaveBeenCalled();
    });

    it('should throw CliError when the fallback clone fails', () => {
      mockRemoteTagExists.mockReturnValue(false);
      mockSpawnSync.mockReturnValue({
        status: 128,
        stdout: Buffer.from(''),
        stderr: Buffer.from('fatal: could not read'),
        pid: 1234,
        output: [],
        signal: null,
      });

      expect(() => cloneTemplateRepo(REPO_URL, TARGET_PATH)).toThrow(CliError);
      expect(mockDeleteFolderRecursive).not.toHaveBeenCalled();
    });

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
