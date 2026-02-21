import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { writeJsonFile } from './write-json-file';
import { CliError } from '../errors';
import * as fs from 'fs';

rs.mock('fs', { mock: true });

describe('writeJsonFile', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should write JSON with proper formatting', () => {
    const data = { name: 'test', version: '1.0.0' };
    rs.mocked(fs.writeFileSync).mockReturnValue(undefined);

    writeJsonFile('/path/to/file.json', data);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/path/to/file.json',
      JSON.stringify(data, null, 2) + '\n',
      'utf-8',
    );
  });

  it('should format JSON with 2 space indent', () => {
    const data = { outer: { inner: 'value' } };
    rs.mocked(fs.writeFileSync).mockReturnValue(undefined);

    writeJsonFile('/path/to/file.json', data);

    const expectedContent = JSON.stringify(data, null, 2) + '\n';
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/path/to/file.json',
      expectedContent,
      'utf-8',
    );
    expect(expectedContent).toContain('  "outer"');
    expect(expectedContent).toContain('    "inner"');
  });

  it('should include trailing newline', () => {
    const data = { key: 'value' };
    rs.mocked(fs.writeFileSync).mockReturnValue(undefined);

    writeJsonFile('/path/to/file.json', data);

    const writtenContent = rs.mocked(fs.writeFileSync).mock
      .calls[0][1] as string;
    expect(writtenContent).toMatch(/\n$/);
  });

  it('should throw CliError when writeFileSync fails', () => {
    rs.mocked(fs.writeFileSync).mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    expect(() => {
      writeJsonFile('/restricted/file.json', { data: 'test' });
    }).toThrow(CliError);
  });

  it('should include file path in error message when write fails', () => {
    rs.mocked(fs.writeFileSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    try {
      writeJsonFile('/nonexistent/dir/file.json', { data: 'test' });
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toContain('/nonexistent/dir/file.json');
      expect(cliError.context).toBe('JSON write failed');
    }
  });

  it('should handle permission errors', () => {
    rs.mocked(fs.writeFileSync).mockImplementation(() => {
      const error: NodeJS.ErrnoException = new Error(
        'EACCES: permission denied',
      );
      error.code = 'EACCES';
      throw error;
    });

    try {
      writeJsonFile('/restricted/file.json', { data: 'test' });
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toContain('EACCES');
    }
  });

  it('should serialize arrays correctly', () => {
    const data = [1, 2, 3, 4, 5];
    rs.mocked(fs.writeFileSync).mockReturnValue(undefined);

    writeJsonFile('/path/to/array.json', data);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/path/to/array.json',
      JSON.stringify(data, null, 2) + '\n',
      'utf-8',
    );
  });

  it('should serialize nested objects correctly', () => {
    const data = {
      level1: {
        level2: {
          level3: 'deep value',
        },
      },
    };
    rs.mocked(fs.writeFileSync).mockReturnValue(undefined);

    writeJsonFile('/path/to/nested.json', data);

    const writtenContent = rs.mocked(fs.writeFileSync).mock
      .calls[0][1] as string;
    expect(writtenContent).toContain('"level1"');
    expect(writtenContent).toContain('"level2"');
    expect(writtenContent).toContain('"level3"');
    expect(writtenContent).toContain('"deep value"');
  });

  it('should handle empty objects', () => {
    const data = {};
    rs.mocked(fs.writeFileSync).mockReturnValue(undefined);

    writeJsonFile('/path/to/empty.json', data);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/path/to/empty.json',
      '{}\n',
      'utf-8',
    );
  });

  it('should handle null values', () => {
    const data = { key: null };
    rs.mocked(fs.writeFileSync).mockReturnValue(undefined);

    writeJsonFile('/path/to/null.json', data);

    const writtenContent = rs.mocked(fs.writeFileSync).mock
      .calls[0][1] as string;
    expect(writtenContent).toContain('null');
  });
});
