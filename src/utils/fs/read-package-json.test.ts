import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';
import { readPackageJson } from './read-package-json';
import { CliError } from '../errors';

// Mock dependencies
rs.mock('./read-json-file', () => ({
  readJsonFile: rs.fn(),
}));

import { readJsonFile } from './read-json-file';

describe('readPackageJson', () => {
  const originalCwd = process.cwd;

  beforeEach(() => {
    rs.clearAllMocks();
    process.cwd = rs.fn().mockReturnValue('/project/root');
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  it('should read package.json from current working directory', () => {
    const packageJson = { name: 'test-package', version: '1.0.0' };
    rs.mocked(readJsonFile).mockReturnValue(packageJson);

    const result = readPackageJson();

    expect(result).toEqual(packageJson);
    expect(readJsonFile).toHaveBeenCalledWith('/project/root/package.json');
  });

  it('should return typed PackageJson with name property', () => {
    rs.mocked(readJsonFile).mockReturnValue({
      name: 'my-service',
      version: '2.0.0',
      description: 'A test service',
    });

    const result = readPackageJson();

    expect(result.name).toBe('my-service');
    expect(result.version).toBe('2.0.0');
    expect(result.description).toBe('A test service');
  });

  it('should propagate CliError when package.json not found', () => {
    rs.mocked(readJsonFile).mockImplementation(() => {
      throw new CliError('File not found', 'JSON file not found', 'Check path');
    });

    expect(() => readPackageJson()).toThrow(CliError);
  });

  it('should handle package.json with author as string', () => {
    rs.mocked(readJsonFile).mockReturnValue({
      name: 'test',
      author: 'John Doe',
    });

    const result = readPackageJson();

    expect(result.author).toBe('John Doe');
  });

  it('should handle package.json with author as object', () => {
    rs.mocked(readJsonFile).mockReturnValue({
      name: 'test',
      author: { name: 'Jane Doe' },
    });

    const result = readPackageJson();

    expect(result.author).toEqual({ name: 'Jane Doe' });
  });
});
