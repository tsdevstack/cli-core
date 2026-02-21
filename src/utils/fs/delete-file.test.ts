import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { deleteFile } from './delete-file';

rs.mock('node:fs', () => ({
  default: {
    unlinkSync: rs.fn(),
  },
}));

import fs from 'node:fs';

describe('deleteFile', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should delete file at given path', () => {
    deleteFile('/path/to/file.txt');

    expect(fs.unlinkSync).toHaveBeenCalledWith('/path/to/file.txt');
  });

  it('should handle paths with special characters', () => {
    deleteFile('/path/to/file with spaces.txt');

    expect(fs.unlinkSync).toHaveBeenCalledWith('/path/to/file with spaces.txt');
  });

  it('should propagate errors from fs.unlinkSync', () => {
    const error = new Error('ENOENT: no such file');
    rs.mocked(fs.unlinkSync).mockImplementationOnce(() => {
      throw error;
    });

    expect(() => deleteFile('/nonexistent.txt')).toThrow(
      'ENOENT: no such file',
    );
  });
});
