import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { CliError } from '../errors';
import * as fs from 'fs';

rs.mock('fs', { mock: true });

import { writeTextFile } from './write-text-file';

describe('writeTextFile', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should write content to file with utf-8 encoding', () => {
      writeTextFile('/path/to/file.txt', 'hello world');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/path/to/file.txt',
        'hello world',
        'utf-8',
      );
    });

    it('should write empty string', () => {
      writeTextFile('/path/to/empty.txt', '');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/path/to/empty.txt',
        '',
        'utf-8',
      );
    });

    it('should write multiline content', () => {
      const content = 'line1\nline2\nline3';
      writeTextFile('/path/to/multi.txt', content);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/path/to/multi.txt',
        content,
        'utf-8',
      );
    });
  });

  describe('Edge cases', () => {
    it('should throw CliError when writeFileSync fails', () => {
      rs.mocked(fs.writeFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      try {
        writeTextFile('/invalid/path/file.txt', 'content');
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('Failed to write file');
        expect(cliError.message).toContain('/invalid/path/file.txt');
        expect(cliError.context).toBe('File write failed');
        expect(cliError.hint).toContain('write permissions');
      }
    });

    it('should handle non-Error thrown by writeFileSync', () => {
      rs.mocked(fs.writeFileSync).mockImplementation(() => {
        throw 'string error';
      });

      try {
        writeTextFile('/path/to/file.txt', 'content');
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('string error');
      }
    });
  });
});
