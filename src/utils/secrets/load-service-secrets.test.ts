import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { loadServiceSecrets } from './load-service-secrets';
import * as fsModule from '../fs';
import * as pathsModule from '../paths';
import type { SecretsFile } from './types';

// Mock dependencies
rs.mock('../fs', { mock: true });
rs.mock('../paths', { mock: true });

describe('loadServiceSecrets', () => {
  const mockRootDir = '/test/project';

  beforeEach(() => {
    rs.clearAllMocks();
    rs.mocked(pathsModule.findProjectRoot).mockReturnValue(mockRootDir);
  });

  describe('Successful loading', () => {
    it('should load service secrets for a given service name', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          AUTH_SECRET: 'secret-123',
        },
        'auth-service': {
          secrets: ['AUTH_SECRET'],
          API_KEY: 'AUTH_SERVICE_API_KEY',
          DATABASE_URL: 'postgresql://localhost/auth',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadServiceSecrets('auth-service');

      expect(result).toEqual({
        secrets: ['AUTH_SECRET'],
        API_KEY: 'AUTH_SERVICE_API_KEY',
        DATABASE_URL: 'postgresql://localhost/auth',
      });
    });

    it('should load secrets for different service names', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'user-service': {
          secrets: [],
          USER_SERVICE_API_KEY: 'user-key',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadServiceSecrets('user-service');

      expect(result).toEqual({
        secrets: [],
        USER_SERVICE_API_KEY: 'user-key',
      });
    });

    it('should return service config with all fields', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: ['API_KEY'],
          API_KEY: 'AUTH_SERVICE_API_KEY',
          ALLOWED_ORIGINS: 'http://localhost:3000',
          DATABASE_URL: 'postgresql://localhost/db',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadServiceSecrets('auth-service');

      expect(result).toHaveProperty('secrets');
      expect(result).toHaveProperty('API_KEY');
      expect(result).toHaveProperty('ALLOWED_ORIGINS');
      expect(result).toHaveProperty('DATABASE_URL');
    });
  });

  describe('Service not found', () => {
    it('should return null when service does not exist', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadServiceSecrets('non-existent-service');

      expect(result).toBeNull();
    });

    it('should return null for empty service name', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadServiceSecrets('');

      expect(result).toBeNull();
    });
  });

  describe('File does not exist', () => {
    it('should return null when secrets file does not exist', () => {
      rs.mocked(fsModule.readJsonFile).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      const result = loadServiceSecrets('auth-service');

      expect(result).toBeNull();
    });

    it('should not throw error when file is missing', () => {
      rs.mocked(fsModule.readJsonFile).mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => loadServiceSecrets('auth-service')).not.toThrow();
    });
  });

  describe('Invalid JSON handling', () => {
    it('should return null when file has invalid JSON', () => {
      rs.mocked(fsModule.readJsonFile).mockImplementation(() => {
        throw new SyntaxError('Unexpected token in JSON');
      });

      const result = loadServiceSecrets('auth-service');

      expect(result).toBeNull();
    });

    it('should return null on any read error', () => {
      rs.mocked(fsModule.readJsonFile).mockImplementation(() => {
        throw new Error('Read error');
      });

      const result = loadServiceSecrets('auth-service');

      expect(result).toBeNull();
    });
  });

  describe('Invalid service configs', () => {
    it('should return null when service config is not an object', () => {
      const mockSecretsFile = {
        secrets: {},
        'invalid-service': 'not an object',
      } as unknown as SecretsFile;

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadServiceSecrets('invalid-service');

      expect(result).toBeNull();
    });

    it('should return null when service config is null', () => {
      const mockSecretsFile = {
        secrets: {},
        'null-service': null,
      } as unknown as SecretsFile;

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadServiceSecrets('null-service');

      expect(result).toBeNull();
    });

    it('should return null when service config is an array', () => {
      const mockSecretsFile = {
        secrets: {},
        'array-service': ['item1', 'item2'],
      } as unknown as SecretsFile;

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadServiceSecrets('array-service');

      expect(result).toBeNull();
    });

    it('should return null when service config is undefined', () => {
      const mockSecretsFile = {
        secrets: {},
        'undefined-service': undefined,
      } as unknown as SecretsFile;

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadServiceSecrets('undefined-service');

      expect(result).toBeNull();
    });
  });

  describe('Metadata fields', () => {
    it('should return null for $comment metadata field', () => {
      const mockSecretsFile: SecretsFile = {
        $comment: 'Auto-generated',
        secrets: {},
        'auth-service': {
          secrets: [],
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadServiceSecrets('$comment');

      // $comment is a string, not an object, so should return null
      expect(result).toBeNull();
    });

    it('should not confuse secrets key with service name', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          API_KEY: 'key-123',
        },
        'auth-service': {
          secrets: [],
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadServiceSecrets('secrets');

      // 'secrets' is the top-level secrets object, not a service
      expect(result).toEqual({
        API_KEY: 'key-123',
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle service with only secrets array', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'minimal-service': {
          secrets: ['KEY1', 'KEY2'],
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadServiceSecrets('minimal-service');

      expect(result).toEqual({
        secrets: ['KEY1', 'KEY2'],
      });
    });

    it('should handle service with empty secrets array', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'empty-service': {
          secrets: [],
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadServiceSecrets('empty-service');

      expect(result).toEqual({
        secrets: [],
      });
    });

    it('should handle service names with special characters', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'my-complex-service-v2': {
          secrets: [],
          API_KEY: 'complex-key',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadServiceSecrets('my-complex-service-v2');

      expect(result).toEqual({
        secrets: [],
        API_KEY: 'complex-key',
      });
    });
  });

  describe('File path construction', () => {
    it('should use findProjectRoot to locate secrets file', () => {
      rs.mocked(fsModule.readJsonFile).mockReturnValue({ secrets: {} });

      loadServiceSecrets('auth-service');

      expect(pathsModule.findProjectRoot).toHaveBeenCalled();
    });

    it('should construct path with LOCAL_SECRETS_FILE constant', () => {
      rs.mocked(fsModule.readJsonFile).mockReturnValue({ secrets: {} });

      loadServiceSecrets('auth-service');

      expect(fsModule.readJsonFile).toHaveBeenCalledWith(
        `${mockRootDir}/.secrets.local.json`,
      );
    });
  });

  describe('Return type', () => {
    it('should return Record<string, unknown> for valid service', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
          stringValue: 'value',
          numberValue: 123,
          boolValue: true,
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadServiceSecrets('auth-service');

      // Should preserve all value types
      expect(result).toEqual({
        secrets: [],
        stringValue: 'value',
        numberValue: 123,
        boolValue: true,
      });
    });
  });

  describe('Multiple services', () => {
    it('should load correct service when multiple exist', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
          AUTH_KEY: 'auth-key',
        },
        'user-service': {
          secrets: [],
          USER_KEY: 'user-key',
        },
        'api-service': {
          secrets: [],
          API_KEY: 'api-key',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const authResult = loadServiceSecrets('auth-service');
      const userResult = loadServiceSecrets('user-service');
      const apiResult = loadServiceSecrets('api-service');

      expect(authResult).toHaveProperty('AUTH_KEY', 'auth-key');
      expect(userResult).toHaveProperty('USER_KEY', 'user-key');
      expect(apiResult).toHaveProperty('API_KEY', 'api-key');
    });
  });
});
