import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { isFile } from './is-file';
import * as fs from 'fs';

rs.mock('fs', { mock: true });

describe('isFile', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should return true when path exists and is a file', () => {
    rs.mocked(fs.existsSync).mockReturnValue(true);
    rs.mocked(fs.statSync).mockReturnValue({
      isFile: () => true,
    } as fs.Stats);

    const result = isFile('/path/to/file.txt');

    expect(result).toBe(true);
    expect(fs.existsSync).toHaveBeenCalledWith('/path/to/file.txt');
    expect(fs.statSync).toHaveBeenCalledWith('/path/to/file.txt');
  });

  it('should return false when path does not exist', () => {
    rs.mocked(fs.existsSync).mockReturnValue(false);

    const result = isFile('/path/to/nonexistent.txt');

    expect(result).toBe(false);
    expect(fs.existsSync).toHaveBeenCalledWith('/path/to/nonexistent.txt');
    expect(fs.statSync).not.toHaveBeenCalled();
  });

  it('should return false when path exists but is a directory', () => {
    rs.mocked(fs.existsSync).mockReturnValue(true);
    rs.mocked(fs.statSync).mockReturnValue({
      isFile: () => false,
    } as fs.Stats);

    const result = isFile('/path/to/directory');

    expect(result).toBe(false);
  });

  it('should return false when statSync throws an error', () => {
    rs.mocked(fs.existsSync).mockReturnValue(true);
    rs.mocked(fs.statSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const result = isFile('/path/to/file.txt');

    expect(result).toBe(false);
  });

  it('should handle permission errors gracefully', () => {
    rs.mocked(fs.existsSync).mockReturnValue(true);
    rs.mocked(fs.statSync).mockImplementation(() => {
      const error: NodeJS.ErrnoException = new Error(
        'EACCES: permission denied',
      );
      error.code = 'EACCES';
      throw error;
    });

    const result = isFile('/restricted/file.txt');

    expect(result).toBe(false);
  });
});
