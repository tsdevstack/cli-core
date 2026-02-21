import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { readJsonFile } from './read-json-file';
import { CliError } from '../errors';
import * as fs from 'fs';

// Mock dependencies
rs.mock('fs', { mock: true });
rs.mock('./is-file', () => ({
  isFile: rs.fn(),
}));

import { isFile } from './is-file';

describe('readJsonFile', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should read and parse valid JSON file', () => {
    const jsonContent = { name: 'test', version: '1.0.0' };
    rs.mocked(isFile).mockReturnValue(true);
    rs.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(jsonContent));

    const result = readJsonFile('/path/to/file.json');

    expect(result).toEqual(jsonContent);
    expect(isFile).toHaveBeenCalledWith('/path/to/file.json');
    expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/file.json', 'utf-8');
  });

  it('should throw CliError when file does not exist', () => {
    rs.mocked(isFile).mockReturnValue(false);

    expect(() => {
      readJsonFile('/path/to/nonexistent.json');
    }).toThrow(CliError);

    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it('should include file path in error message when file does not exist', () => {
    rs.mocked(isFile).mockReturnValue(false);

    try {
      readJsonFile('/path/to/missing.json');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toContain('/path/to/missing.json');
      expect(cliError.context).toBe('JSON file not found');
    }
  });

  it('should throw CliError when JSON is invalid', () => {
    rs.mocked(isFile).mockReturnValue(true);
    rs.mocked(fs.readFileSync).mockReturnValue('{ invalid json }');

    expect(() => {
      readJsonFile('/path/to/invalid.json');
    }).toThrow(CliError);
  });

  it('should include file path and error details for invalid JSON', () => {
    rs.mocked(isFile).mockReturnValue(true);
    rs.mocked(fs.readFileSync).mockReturnValue('{ "key": invalid }');

    try {
      readJsonFile('/path/to/invalid.json');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toContain('/path/to/invalid.json');
      expect(cliError.context).toBe('Invalid JSON');
    }
  });

  it('should throw CliError when readFileSync fails', () => {
    rs.mocked(isFile).mockReturnValue(true);
    rs.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    expect(() => {
      readJsonFile('/restricted/file.json');
    }).toThrow(CliError);
  });

  it('should support generic type parameter', () => {
    interface TestData {
      name: string;
      count: number;
    }

    const jsonContent: TestData = { name: 'test', count: 42 };
    rs.mocked(isFile).mockReturnValue(true);
    rs.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(jsonContent));

    const result = readJsonFile<TestData>('/path/to/typed.json');

    expect(result.name).toBe('test');
    expect(result.count).toBe(42);
  });

  it('should parse nested JSON objects', () => {
    const jsonContent = {
      outer: {
        inner: {
          value: 'nested',
        },
      },
      array: [1, 2, 3],
    };
    rs.mocked(isFile).mockReturnValue(true);
    rs.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(jsonContent));

    const result = readJsonFile<typeof jsonContent>('/path/to/nested.json');

    expect(result).toEqual(jsonContent);
    expect(result.outer.inner.value).toBe('nested');
    expect(result.array).toEqual([1, 2, 3]);
  });
});
