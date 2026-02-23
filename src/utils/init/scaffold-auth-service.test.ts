import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const {
  mockCloneTemplateRepo,
  mockReplacePlaceholdersInFile,
  mockRemoveTemplateMetadata,
  mockReadPackageJsonFrom,
  mockWritePackageJson,
  mockResolveTemplateVersions,
  mockLogger,
} = rs.hoisted(() => ({
  mockCloneTemplateRepo: rs.fn(),
  mockReplacePlaceholdersInFile: rs.fn(),
  mockRemoveTemplateMetadata: rs.fn(),
  mockReadPackageJsonFrom: rs.fn(),
  mockWritePackageJson: rs.fn(),
  mockResolveTemplateVersions: rs.fn(),
  mockLogger: {
    generating: rs.fn(),
    success: rs.fn(),
    warn: rs.fn(),
  },
}));

rs.mock('../template', () => ({
  cloneTemplateRepo: mockCloneTemplateRepo,
  replacePlaceholdersInFile: mockReplacePlaceholdersInFile,
  removeTemplateMetadata: mockRemoveTemplateMetadata,
}));
rs.mock('../fs', () => ({
  readPackageJsonFrom: mockReadPackageJsonFrom,
  writePackageJson: mockWritePackageJson,
}));
rs.mock('../add-service/resolve-template-versions', () => ({
  resolveTemplateVersions: mockResolveTemplateVersions,
}));
rs.mock('../logger', () => ({
  logger: mockLogger,
}));

import { scaffoldAuthService } from './scaffold-auth-service';
import { NESTJS_AUTH_TEMPLATE_REPO } from '../../constants';
import type { FrameworkConfig } from '../config/types';

describe('scaffoldAuthService', () => {
  let config: FrameworkConfig;

  beforeEach(() => {
    rs.clearAllMocks();
    mockReadPackageJsonFrom.mockReturnValue({ name: 'auth-service' });

    config = {
      project: { name: 'my-app', version: '0.1.0' },
      cloud: { provider: null },
      services: [],
    };
  });

  describe('Standard use cases', () => {
    it('should clone from NESTJS_AUTH_TEMPLATE_REPO', () => {
      scaffoldAuthService('/fake/project', config);

      expect(mockCloneTemplateRepo).toHaveBeenCalledWith(
        NESTJS_AUTH_TEMPLATE_REPO,
        '/fake/project/apps/auth-service',
      );
    });

    it('should replace SERVICE_NAME and AUTHOR placeholders', () => {
      scaffoldAuthService('/fake/project', config);

      expect(mockReplacePlaceholdersInFile).toHaveBeenCalled();
      const firstCallReplacements =
        mockReplacePlaceholdersInFile.mock.calls[0][1];
      expect(firstCallReplacements['\\{\\{SERVICE_NAME\\}\\}']).toBe(
        'auth-service',
      );
      expect(firstCallReplacements['\\{\\{AUTHOR\\}\\}']).toBe('my-app');
    });

    it('should remove template metadata', () => {
      scaffoldAuthService('/fake/project', config);

      expect(mockRemoveTemplateMetadata).toHaveBeenCalledWith(
        '/fake/project/apps/auth-service',
      );
    });

    it('should resolve template versions', () => {
      scaffoldAuthService('/fake/project', config);

      expect(mockResolveTemplateVersions).toHaveBeenCalledWith(
        { name: 'auth-service' },
        '/fake/project',
      );
    });

    it('should register auth-service in config with correct properties', () => {
      scaffoldAuthService('/fake/project', config);

      expect(config.services).toHaveLength(1);
      expect(config.services[0]).toEqual({
        name: 'auth-service',
        type: 'nestjs',
        port: 3001,
        globalPrefix: 'auth',
        hasDatabase: true,
        databaseType: 'postgresql',
      });
    });
  });

  describe('Edge cases', () => {
    it('should warn but not throw when version resolution fails', () => {
      mockReadPackageJsonFrom.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      scaffoldAuthService('/fake/project', config);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not resolve'),
      );
      expect(config.services).toHaveLength(1);
    });
  });
});
