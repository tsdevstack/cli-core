/**
 * Tests for resolveTemplateVersions
 */

import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { resolveTemplateVersions } from './resolve-template-versions';

// Mock dependencies
rs.mock('fs', { mock: true });
rs.mock('../fs', { mock: true });
rs.mock('../logger', { mock: true });

import * as fs from 'fs';
import { readPackageJsonFrom } from '../fs';
import { logger } from '../logger';
import type { PackageJson } from '../fs/package-json-types';

describe('resolveTemplateVersions', () => {
  const PROJECT_ROOT = '/fake/project';

  beforeEach(() => {
    rs.clearAllMocks();

    // Default: apps directory exists with no entries
    rs.mocked(fs.existsSync).mockReturnValue(true);
    rs.mocked(fs.readdirSync).mockReturnValue([]);

    // Default: root package.json has no dependencies
    rs.mocked(readPackageJsonFrom).mockReturnValue({
      name: 'test-project',
      version: '1.0.0',
    });
  });

  it('should not modify versions when project has no matching dependencies', () => {
    const templatePkg: PackageJson = {
      name: 'my-app',
      dependencies: {
        react: '^19.0.0',
        next: '^16.0.0',
      },
    };

    resolveTemplateVersions(templatePkg, PROJECT_ROOT);

    expect((templatePkg.dependencies as Record<string, string>).react).toBe(
      '^19.0.0',
    );
    expect((templatePkg.dependencies as Record<string, string>).next).toBe(
      '^16.0.0',
    );
  });

  it('should resolve versions from root package.json', () => {
    rs.mocked(readPackageJsonFrom).mockReturnValue({
      name: 'test-project',
      devDependencies: {
        typescript: '^5.5.0',
        eslint: '^9.10.0',
      },
    });

    const templatePkg: PackageJson = {
      name: 'my-app',
      devDependencies: {
        typescript: '^5.0.0',
        eslint: '^9.0.0',
      },
    };

    resolveTemplateVersions(templatePkg, PROJECT_ROOT);

    expect(
      (templatePkg.devDependencies as Record<string, string>).typescript,
    ).toBe('^5.5.0');
    expect((templatePkg.devDependencies as Record<string, string>).eslint).toBe(
      '^9.10.0',
    );
  });

  it('should resolve versions from existing app packages', () => {
    rs.mocked(readPackageJsonFrom).mockImplementation((dirPath: string) => {
      if (dirPath === PROJECT_ROOT) {
        return { name: 'test-project' };
      }
      if (dirPath === `${PROJECT_ROOT}/apps/frontend`) {
        return {
          name: 'frontend',
          dependencies: {
            react: '^19.2.3',
            next: '^16.0.10',
          },
        };
      }
      return { name: 'unknown' };
    });

    rs.mocked(fs.readdirSync).mockReturnValue([
      'frontend',
    ] as unknown as ReturnType<typeof fs.readdirSync>);
    rs.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => true,
    } as fs.Stats);

    const templatePkg: PackageJson = {
      name: 'my-app',
      dependencies: {
        react: '^19.0.0',
        next: '^16.0.0',
        axios: '^1.12.0',
      },
    };

    resolveTemplateVersions(templatePkg, PROJECT_ROOT);

    expect((templatePkg.dependencies as Record<string, string>).react).toBe(
      '^19.2.3',
    );
    expect((templatePkg.dependencies as Record<string, string>).next).toBe(
      '^16.0.10',
    );
    // axios not in project, keeps template default
    expect((templatePkg.dependencies as Record<string, string>).axios).toBe(
      '^1.12.0',
    );
  });

  it('should skip workspace packages with wildcard version', () => {
    rs.mocked(readPackageJsonFrom).mockImplementation((dirPath: string) => {
      if (dirPath === PROJECT_ROOT) {
        return { name: 'test-project' };
      }
      if (dirPath === `${PROJECT_ROOT}/apps/auth-service`) {
        return {
          name: 'auth-service',
          dependencies: {
            '@tsdevstack/nest-common': '*',
          },
        };
      }
      return { name: 'unknown' };
    });

    rs.mocked(fs.readdirSync).mockReturnValue([
      'auth-service',
    ] as unknown as ReturnType<typeof fs.readdirSync>);
    rs.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => true,
    } as fs.Stats);

    const templatePkg: PackageJson = {
      name: 'my-app',
      dependencies: {
        '@tsdevstack/nest-common': '*',
        '@shared/auth-service-client': '*',
      },
    };

    resolveTemplateVersions(templatePkg, PROJECT_ROOT);

    // Wildcard packages should remain unchanged
    expect(
      (templatePkg.dependencies as Record<string, string>)[
        '@tsdevstack/nest-common'
      ],
    ).toBe('*');
    expect(
      (templatePkg.dependencies as Record<string, string>)[
        '@shared/auth-service-client'
      ],
    ).toBe('*');
  });

  it('should not modify versions that already match', () => {
    rs.mocked(readPackageJsonFrom).mockReturnValue({
      name: 'test-project',
      devDependencies: {
        typescript: '^5.0.0',
      },
    });

    const templatePkg: PackageJson = {
      name: 'my-app',
      devDependencies: {
        typescript: '^5.0.0',
      },
    };

    resolveTemplateVersions(templatePkg, PROJECT_ROOT);

    expect(
      (templatePkg.devDependencies as Record<string, string>).typescript,
    ).toBe('^5.0.0');
    // No info log when no versions were resolved
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should log the number of resolved versions', () => {
    rs.mocked(readPackageJsonFrom).mockReturnValue({
      name: 'test-project',
      devDependencies: {
        typescript: '^5.5.0',
        eslint: '^9.10.0',
      },
    });

    const templatePkg: PackageJson = {
      name: 'my-app',
      devDependencies: {
        typescript: '^5.0.0',
        eslint: '^9.0.0',
      },
    };

    resolveTemplateVersions(templatePkg, PROJECT_ROOT);

    expect(logger.info).toHaveBeenCalledWith(
      'Resolved 2 dependency version(s) to match your project',
    );
  });

  it('should handle missing apps directory gracefully', () => {
    rs.mocked(fs.existsSync).mockReturnValue(false);

    const templatePkg: PackageJson = {
      name: 'my-app',
      dependencies: { react: '^19.0.0' },
    };

    // Should not throw
    resolveTemplateVersions(templatePkg, PROJECT_ROOT);

    expect((templatePkg.dependencies as Record<string, string>).react).toBe(
      '^19.0.0',
    );
  });

  it('should handle package.json with no dependencies sections', () => {
    const templatePkg: PackageJson = {
      name: 'my-app',
    };

    // Should not throw
    resolveTemplateVersions(templatePkg, PROJECT_ROOT);
  });

  it('should skip non-directory entries in apps/', () => {
    rs.mocked(fs.readdirSync).mockReturnValue([
      '.DS_Store',
      'frontend',
    ] as unknown as ReturnType<typeof fs.readdirSync>);
    rs.mocked(fs.statSync).mockImplementation((p: fs.PathLike) => {
      const pathStr = String(p);
      if (pathStr.includes('.DS_Store')) {
        return { isDirectory: () => false } as fs.Stats;
      }
      return { isDirectory: () => true } as fs.Stats;
    });

    rs.mocked(readPackageJsonFrom).mockImplementation((dirPath: string) => {
      if (dirPath === PROJECT_ROOT) {
        return { name: 'test-project' };
      }
      if (dirPath === `${PROJECT_ROOT}/apps/frontend`) {
        return {
          name: 'frontend',
          dependencies: { react: '^19.2.3' },
        };
      }
      return { name: 'unknown' };
    });

    const templatePkg: PackageJson = {
      name: 'my-app',
      dependencies: { react: '^19.0.0' },
    };

    resolveTemplateVersions(templatePkg, PROJECT_ROOT);

    expect((templatePkg.dependencies as Record<string, string>).react).toBe(
      '^19.2.3',
    );
    // Should not try to read .DS_Store as package
    expect(readPackageJsonFrom).not.toHaveBeenCalledWith(
      `${PROJECT_ROOT}/apps/.DS_Store`,
    );
  });

  it('should skip apps with invalid package.json gracefully', () => {
    rs.mocked(readPackageJsonFrom).mockImplementation((dirPath: string) => {
      if (dirPath === PROJECT_ROOT) {
        return { name: 'test-project' };
      }
      if (dirPath === `${PROJECT_ROOT}/apps/broken-app`) {
        throw new Error('Invalid JSON');
      }
      if (dirPath === `${PROJECT_ROOT}/apps/frontend`) {
        return {
          name: 'frontend',
          dependencies: { react: '^19.2.3' },
        };
      }
      return { name: 'unknown' };
    });

    rs.mocked(fs.readdirSync).mockReturnValue([
      'broken-app',
      'frontend',
    ] as unknown as ReturnType<typeof fs.readdirSync>);
    rs.mocked(fs.statSync).mockReturnValue({
      isDirectory: () => true,
    } as fs.Stats);

    const templatePkg: PackageJson = {
      name: 'my-app',
      dependencies: { react: '^19.0.0' },
    };

    // Should not throw — skip broken, use valid
    resolveTemplateVersions(templatePkg, PROJECT_ROOT);

    expect((templatePkg.dependencies as Record<string, string>).react).toBe(
      '^19.2.3',
    );
  });
});
