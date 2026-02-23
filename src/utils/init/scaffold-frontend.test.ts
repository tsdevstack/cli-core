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

import { scaffoldFrontend } from './scaffold-frontend';
import { NEXTJS_AUTH_TEMPLATE_REPO } from '../../constants';
import type { FrameworkConfig } from '../config/types';

describe('scaffoldFrontend', () => {
  let config: FrameworkConfig;

  beforeEach(() => {
    rs.clearAllMocks();
    mockReadPackageJsonFrom.mockReturnValue({ name: 'frontend' });

    config = {
      project: { name: 'my-app', version: '0.1.0' },
      cloud: { provider: null },
      services: [],
    };
  });

  describe('Standard use cases', () => {
    it('should clone from NEXTJS_AUTH_TEMPLATE_REPO', () => {
      scaffoldFrontend('/fake/project', 'frontend', config);

      expect(mockCloneTemplateRepo).toHaveBeenCalledWith(
        NEXTJS_AUTH_TEMPLATE_REPO,
        '/fake/project/apps/frontend',
      );
    });

    it('should replace SERVICE_NAME and AUTHOR placeholders in package.json', () => {
      scaffoldFrontend('/fake/project', 'frontend', config);

      expect(mockReplacePlaceholdersInFile).toHaveBeenCalledTimes(1);
      expect(mockReplacePlaceholdersInFile).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        {
          '\\{\\{SERVICE_NAME\\}\\}': 'frontend',
          '\\{\\{AUTHOR\\}\\}': 'my-app',
        },
      );
    });

    it('should remove template metadata', () => {
      scaffoldFrontend('/fake/project', 'frontend', config);

      expect(mockRemoveTemplateMetadata).toHaveBeenCalledWith(
        '/fake/project/apps/frontend',
      );
    });

    it('should resolve template versions', () => {
      scaffoldFrontend('/fake/project', 'frontend', config);

      expect(mockResolveTemplateVersions).toHaveBeenCalledWith(
        { name: 'frontend' },
        '/fake/project',
      );
    });

    it('should register frontend in config with correct properties', () => {
      scaffoldFrontend('/fake/project', 'frontend', config);

      expect(config.services).toHaveLength(1);
      expect(config.services[0]).toEqual({
        name: 'frontend',
        type: 'nextjs',
        port: 3000,
        hasDatabase: false,
      });
    });

    it('should use the provided frontend name', () => {
      scaffoldFrontend('/fake/project', 'web-app', config);

      expect(mockCloneTemplateRepo).toHaveBeenCalledWith(
        NEXTJS_AUTH_TEMPLATE_REPO,
        '/fake/project/apps/web-app',
      );
      expect(config.services[0]?.name).toBe('web-app');
    });
  });

  describe('Edge cases', () => {
    it('should warn but not throw when version resolution fails', () => {
      mockReadPackageJsonFrom.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      scaffoldFrontend('/fake/project', 'frontend', config);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not resolve'),
      );
      expect(config.services).toHaveLength(1);
    });
  });
});
