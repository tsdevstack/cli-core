import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { loadFrameworkSecrets } from './load-framework-secrets';
import * as fsModule from '../fs';
import * as pathsModule from '../paths';
import type { SecretsFile } from './types';

// Mock dependencies
rs.mock('../fs', { mock: true });
rs.mock('../paths', { mock: true });

describe('loadFrameworkSecrets', () => {
  const mockRootDir = '/test/project';

  beforeEach(() => {
    rs.clearAllMocks();
    rs.mocked(pathsModule.findProjectRoot).mockReturnValue(mockRootDir);
  });

  describe('Successful loading', () => {
    it('should load and return framework secrets file', () => {
      const mockSecretsFile: SecretsFile = {
        $comment: 'Framework secrets',
        secrets: {
          AUTH_SECRET: 'test-secret-123',
          API_KEY: 'test-api-key',
        },
        'auth-service': {
          secrets: ['AUTH_SECRET'],
          API_KEY: 'AUTH_SERVICE_API_KEY',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadFrameworkSecrets(mockRootDir);

      expect(result).toEqual(mockSecretsFile);
      expect(fsModule.readJsonFile).toHaveBeenCalledWith(
        `${mockRootDir}/.secrets.tsdevstack.json`,
      );
    });

    it('should load file with flattened REDIS structure', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          AUTH_SECRET: 'secret-123',
          REDIS_HOST: 'localhost',
          REDIS_PORT: '6379',
          REDIS_PASSWORD: 'redis-pass',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadFrameworkSecrets(mockRootDir);

      expect(result).toEqual(mockSecretsFile);
      expect(result?.secrets.REDIS_HOST).toBe('localhost');
      expect(result?.secrets.REDIS_PORT).toBe('6379');
      expect(result?.secrets.REDIS_PASSWORD).toBe('redis-pass');
    });

    it('should load file with metadata fields', () => {
      const mockSecretsFile: SecretsFile = {
        $comment: 'Auto-generated secrets',
        $warning: 'Do not edit',
        $generated_at: '2024-01-01T00:00:00.000Z',
        secrets: {
          API_KEY: 'test-key',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadFrameworkSecrets(mockRootDir);

      expect(result).toEqual(mockSecretsFile);
      expect(result?.$comment).toBe('Auto-generated secrets');
      expect(result?.$warning).toBe('Do not edit');
      expect(result?.$generated_at).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should load file with multiple services', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          AUTH_SECRET: 'secret-123',
        },
        'auth-service': {
          secrets: ['AUTH_SECRET'],
          API_KEY: 'AUTH_SERVICE_API_KEY',
        },
        'user-service': {
          secrets: ['DATABASE_URL'],
          API_KEY: 'USER_SERVICE_API_KEY',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadFrameworkSecrets(mockRootDir);

      expect(result).toEqual(mockSecretsFile);
    });
  });

  describe('File does not exist', () => {
    it('should return null when file does not exist', () => {
      rs.mocked(fsModule.readJsonFile).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const result = loadFrameworkSecrets(mockRootDir);

      expect(result).toBeNull();
    });

    it('should not throw error when file is missing', () => {
      rs.mocked(fsModule.readJsonFile).mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => loadFrameworkSecrets(mockRootDir)).not.toThrow();
    });
  });

  describe('Invalid JSON handling', () => {
    it('should return null when file has invalid JSON', () => {
      rs.mocked(fsModule.readJsonFile).mockImplementation(() => {
        throw new SyntaxError('Unexpected token in JSON');
      });

      const result = loadFrameworkSecrets(mockRootDir);

      expect(result).toBeNull();
    });

    it('should return null when file is corrupted', () => {
      rs.mocked(fsModule.readJsonFile).mockImplementation(() => {
        throw new Error('JSON parse error');
      });

      const result = loadFrameworkSecrets(mockRootDir);

      expect(result).toBeNull();
    });
  });

  describe('Permission errors', () => {
    it('should return null on permission denied', () => {
      rs.mocked(fsModule.readJsonFile).mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = loadFrameworkSecrets(mockRootDir);

      expect(result).toBeNull();
    });
  });

  describe('Default rootDir behavior', () => {
    it('should use findProjectRoot when rootDir not provided', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          API_KEY: 'test-key',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      loadFrameworkSecrets();

      expect(pathsModule.findProjectRoot).toHaveBeenCalled();
      expect(fsModule.readJsonFile).toHaveBeenCalledWith(
        `${mockRootDir}/.secrets.tsdevstack.json`,
      );
    });
  });

  describe('Empty or minimal files', () => {
    it('should handle file with only secrets field', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          API_KEY: 'test-key',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadFrameworkSecrets(mockRootDir);

      expect(result).toEqual(mockSecretsFile);
    });

    it('should handle file with empty secrets object', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadFrameworkSecrets(mockRootDir);

      expect(result).toEqual(mockSecretsFile);
    });
  });

  describe('Type safety', () => {
    it('should return SecretsFile type or null', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          API_KEY: 'test-key',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadFrameworkSecrets(mockRootDir);

      // TypeScript type check - result should be SecretsFile | null
      if (result) {
        expect(result.secrets).toBeDefined();
      }
    });
  });

  describe('File path construction', () => {
    it('should construct correct file path', () => {
      rs.mocked(fsModule.readJsonFile).mockReturnValue({ secrets: {} });

      loadFrameworkSecrets('/custom/path');

      expect(fsModule.readJsonFile).toHaveBeenCalledWith(
        '/custom/path/.secrets.tsdevstack.json',
      );
    });

    it('should use FRAMEWORK_SECRETS_FILE constant', () => {
      rs.mocked(fsModule.readJsonFile).mockReturnValue({ secrets: {} });

      loadFrameworkSecrets(mockRootDir);

      // Should call with path containing .secrets.tsdevstack.json
      expect(fsModule.readJsonFile).toHaveBeenCalledWith(
        expect.stringContaining('.secrets.tsdevstack.json'),
      );
    });
  });
});
