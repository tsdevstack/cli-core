import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { CliError } from '../errors';
import * as fs from 'fs';

rs.mock('fs', { mock: true });
rs.mock('./is-directory', () => ({
  isDirectory: rs.fn(),
}));

import { deleteFolderRecursive } from './delete-folder-recursive';
import { isDirectory } from './is-directory';

describe('deleteFolderRecursive', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should delete directory recursively', () => {
      rs.mocked(fs.existsSync).mockReturnValue(true);
      rs.mocked(isDirectory).mockReturnValue(true);

      deleteFolderRecursive('/path/to/folder');

      expect(fs.rmSync).toHaveBeenCalledWith('/path/to/folder', {
        recursive: true,
        force: true,
      });
    });

    it('should return silently when path does not exist', () => {
      rs.mocked(fs.existsSync).mockReturnValue(false);

      deleteFolderRecursive('/nonexistent/path');

      expect(isDirectory).not.toHaveBeenCalled();
      expect(fs.rmSync).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should throw CliError when path is not a directory', () => {
      rs.mocked(fs.existsSync).mockReturnValue(true);
      rs.mocked(isDirectory).mockReturnValue(false);

      expect(() => {
        deleteFolderRecursive('/path/to/file.txt');
      }).toThrow(CliError);

      expect(fs.rmSync).not.toHaveBeenCalled();
    });

    it('should include path in error when not a directory', () => {
      rs.mocked(fs.existsSync).mockReturnValue(true);
      rs.mocked(isDirectory).mockReturnValue(false);

      try {
        deleteFolderRecursive('/path/to/file.txt');
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('/path/to/file.txt');
        expect(cliError.context).toBe('Folder deletion failed');
      }
    });

    it('should throw CliError when rmSync fails', () => {
      rs.mocked(fs.existsSync).mockReturnValue(true);
      rs.mocked(isDirectory).mockReturnValue(true);
      rs.mocked(fs.rmSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      try {
        deleteFolderRecursive('/path/to/folder');
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('Failed to delete folder');
        expect(cliError.message).toContain('EACCES: permission denied');
        expect(cliError.hint).toContain('write permissions');
      }
    });

    it('should handle non-Error thrown by rmSync', () => {
      rs.mocked(fs.existsSync).mockReturnValue(true);
      rs.mocked(isDirectory).mockReturnValue(true);
      rs.mocked(fs.rmSync).mockImplementation(() => {
        throw 'string error';
      });

      try {
        deleteFolderRecursive('/path/to/folder');
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('string error');
      }
    });
  });
});
