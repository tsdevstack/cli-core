import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { readPackageJsonFrom } from './read-package-json-from';
import { CliError } from '../errors';

// Mock dependencies
rs.mock('./read-json-file', () => ({
  readJsonFile: rs.fn(),
}));

import { readJsonFile } from './read-json-file';

describe('readPackageJsonFrom', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should read package.json from specified directory', () => {
    const packageJson = { name: 'test-package', version: '1.0.0' };
    rs.mocked(readJsonFile).mockReturnValue(packageJson);

    const result = readPackageJsonFrom('/apps/my-service');

    expect(result).toEqual(packageJson);
    expect(readJsonFile).toHaveBeenCalledWith('/apps/my-service/package.json');
  });

  it('should handle paths with trailing slash', () => {
    rs.mocked(readJsonFile).mockReturnValue({ name: 'test' });

    readPackageJsonFrom('/apps/service/');

    // path.join normalizes the path
    expect(readJsonFile).toHaveBeenCalledWith('/apps/service/package.json');
  });

  it('should propagate CliError when package.json not found', () => {
    rs.mocked(readJsonFile).mockImplementation(() => {
      throw new CliError('File not found', 'JSON file not found', 'Check path');
    });

    expect(() => readPackageJsonFrom('/nonexistent/path')).toThrow(CliError);
  });

  it('should return typed PackageJson', () => {
    rs.mocked(readJsonFile).mockReturnValue({
      name: 'auth-service',
      version: '1.2.3',
      description: 'Authentication service',
      author: 'Team',
    });

    const result = readPackageJsonFrom('/apps/auth-service');

    expect(result.name).toBe('auth-service');
    expect(result.version).toBe('1.2.3');
    expect(result.description).toBe('Authentication service');
    expect(result.author).toBe('Team');
  });

  it('should handle package.json with additional properties', () => {
    rs.mocked(readJsonFile).mockReturnValue({
      name: 'test',
      scripts: { build: 'tsc' },
      dependencies: { lodash: '^4.0.0' },
    });

    const result = readPackageJsonFrom('/some/path');

    expect(result.name).toBe('test');
    expect(result.scripts).toEqual({ build: 'tsc' });
    expect(result.dependencies).toEqual({ lodash: '^4.0.0' });
  });
});
