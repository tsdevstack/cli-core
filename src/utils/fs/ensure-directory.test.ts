import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { CliError } from '../errors';
import * as fs from 'fs';

rs.mock('fs', { mock: true });

import { ensureDirectory } from './ensure-directory';

describe('ensureDirectory', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should create directory when it does not exist', () => {
      rs.mocked(fs.existsSync).mockReturnValue(false);

      ensureDirectory('/path/to/new/dir');

      expect(fs.mkdirSync).toHaveBeenCalledWith('/path/to/new/dir', {
        recursive: true,
      });
    });

    it('should not create directory when it already exists', () => {
      rs.mocked(fs.existsSync).mockReturnValue(true);

      ensureDirectory('/path/to/existing/dir');

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should throw CliError when mkdirSync fails', () => {
      rs.mocked(fs.existsSync).mockReturnValue(false);
      rs.mocked(fs.mkdirSync).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      try {
        ensureDirectory('/restricted/dir');
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('Failed to create directory');
        expect(cliError.message).toContain('/restricted/dir');
        expect(cliError.context).toBe('Directory creation failed');
        expect(cliError.hint).toContain('write permissions');
      }
    });

    it('should handle non-Error thrown by mkdirSync', () => {
      rs.mocked(fs.existsSync).mockReturnValue(false);
      rs.mocked(fs.mkdirSync).mockImplementation(() => {
        throw 'string error';
      });

      try {
        ensureDirectory('/some/dir');
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('string error');
      }
    });
  });
});
