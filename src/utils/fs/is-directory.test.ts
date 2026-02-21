import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { isDirectory } from './is-directory';
import * as fs from 'fs';

rs.mock('fs', { mock: true });

describe('isDirectory', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should return true when path exists and is a directory', () => {
    rs.mocked(fs.existsSync).mockReturnValue(true);
    rs.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => true,
    } as fs.Stats);

    const result = isDirectory('/path/to/directory');

    expect(result).toBe(true);
    expect(fs.existsSync).toHaveBeenCalledWith('/path/to/directory');
    expect(fs.statSync).toHaveBeenCalledWith('/path/to/directory');
  });

  it('should return false when path does not exist', () => {
    rs.mocked(fs.existsSync).mockReturnValue(false);

    const result = isDirectory('/path/to/nonexistent');

    expect(result).toBe(false);
    expect(fs.existsSync).toHaveBeenCalledWith('/path/to/nonexistent');
    expect(fs.statSync).not.toHaveBeenCalled();
  });

  it('should return false when path exists but is a file', () => {
    rs.mocked(fs.existsSync).mockReturnValue(true);
    rs.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => false,
    } as fs.Stats);

    const result = isDirectory('/path/to/file.txt');

    expect(result).toBe(false);
  });

  it('should return false when statSync throws an error', () => {
    rs.mocked(fs.existsSync).mockReturnValue(true);
    rs.mocked(fs.statSync).mockImplementation(() => {
      throw new Error('Permission denied');
    });

    const result = isDirectory('/path/to/directory');

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

    const result = isDirectory('/restricted/directory');

    expect(result).toBe(false);
  });
});
