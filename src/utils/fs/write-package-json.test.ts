import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { writePackageJson } from './write-package-json';

// Mock dependencies
rs.mock('./write-json-file', () => ({
  writeJsonFile: rs.fn(),
}));

import { writeJsonFile } from './write-json-file';

describe('writePackageJson', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should write package.json to specified directory', () => {
    const packageJson = { name: 'test-package', version: '1.0.0' };

    writePackageJson('/apps/my-service', packageJson);

    expect(writeJsonFile).toHaveBeenCalledWith(
      '/apps/my-service/package.json',
      packageJson,
    );
  });

  it('should handle paths with trailing slash', () => {
    writePackageJson('/apps/service/', { name: 'test' });

    // path.join normalizes the path
    expect(writeJsonFile).toHaveBeenCalledWith('/apps/service/package.json', {
      name: 'test',
    });
  });

  it('should write package.json with all fields', () => {
    const packageJson = {
      name: 'auth-service',
      version: '2.0.0',
      description: 'Auth service',
      author: 'Team',
      scripts: { build: 'tsc' },
      dependencies: { express: '^4.0.0' },
    };

    writePackageJson('/apps/auth', packageJson);

    expect(writeJsonFile).toHaveBeenCalledWith(
      '/apps/auth/package.json',
      packageJson,
    );
  });

  it('should propagate errors from writeJsonFile', () => {
    rs.mocked(writeJsonFile).mockImplementation(() => {
      throw new Error('Write failed');
    });

    expect(() => writePackageJson('/invalid/path', { name: 'test' })).toThrow(
      'Write failed',
    );
  });
});
