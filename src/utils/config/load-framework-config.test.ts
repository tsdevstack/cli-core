import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockReadJsonFile, mockGetConfigPath } = rs.hoisted(() => ({
  mockReadJsonFile: rs.fn(),
  mockGetConfigPath: rs.fn(),
}));

rs.mock('../fs', () => ({
  readJsonFile: mockReadJsonFile,
}));
rs.mock('../paths', () => ({
  getConfigPath: mockGetConfigPath,
}));

import { loadFrameworkConfig } from './load-framework-config';
import { CliError } from '../errors';

describe('loadFrameworkConfig', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockGetConfigPath.mockReturnValue('/project/.tsdevstack/config.json');
  });

  describe('Standard use cases', () => {
    it('should load and return framework config', () => {
      const mockConfig = {
        project: { name: 'test', version: '1.0.0' },
        cloud: { provider: 'gcp' },
        services: [],
      };
      mockReadJsonFile.mockReturnValue(mockConfig);

      const result = loadFrameworkConfig();

      expect(result).toEqual(mockConfig);
      expect(mockGetConfigPath).toHaveBeenCalled();
      expect(mockReadJsonFile).toHaveBeenCalledWith(
        '/project/.tsdevstack/config.json',
      );
    });

    it('should return config with services', () => {
      const mockConfig = {
        project: { name: 'my-app', version: '2.0.0' },
        cloud: { provider: 'aws' },
        services: [
          { name: 'auth-service', type: 'nestjs', port: 3000 },
          { name: 'frontend', type: 'nextjs', port: 4000 },
        ],
      };
      mockReadJsonFile.mockReturnValue(mockConfig);

      const result = loadFrameworkConfig();

      expect(result.services).toHaveLength(2);
      expect(result.project.name).toBe('my-app');
    });
  });

  describe('Error handling', () => {
    it('should throw CliError when config file is not found', () => {
      mockReadJsonFile.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => loadFrameworkConfig()).toThrow(CliError);
    });

    it('should include helpful message in error', () => {
      mockReadJsonFile.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      try {
        loadFrameworkConfig();
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('config.json');
        expect(cliError.context).toBe('Framework configuration not found');
        expect(cliError.hint).toContain('tsdevstack project');
      }
    });

    it('should throw CliError when readJsonFile fails for any reason', () => {
      mockReadJsonFile.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(() => loadFrameworkConfig()).toThrow(CliError);
    });
  });
});
