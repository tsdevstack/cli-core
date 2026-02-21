import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { loadLocalSecrets } from './load-local-secrets';
import * as fsModule from '../fs';
import * as pathsModule from '../paths';
import { CliError } from '../errors';
import type { SecretsFile } from './types';

// Mock dependencies
rs.mock('../fs', { mock: true });
rs.mock('../paths', { mock: true });

describe('loadLocalSecrets', () => {
  const mockRootDir = '/test/project';

  beforeEach(() => {
    rs.clearAllMocks();
    rs.mocked(pathsModule.findProjectRoot).mockReturnValue(mockRootDir);
  });

  describe('Basic flattening', () => {
    it('should flatten simple string secrets', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          API_KEY: 'test-key-123',
          AUTH_SECRET: 'secret-456',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(false, mockRootDir);

      expect(result).toEqual({
        API_KEY: 'test-key-123',
        AUTH_SECRET: 'secret-456',
      });
    });

    it('should load flattened REDIS secrets', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          API_KEY: 'test-key',
          REDIS_HOST: 'localhost',
          REDIS_PORT: '6379',
          REDIS_PASSWORD: 'redis-pass',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(false, mockRootDir);

      expect(result).toEqual({
        API_KEY: 'test-key',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_PASSWORD: 'redis-pass',
      });
    });

    it('should handle multiple flat secrets', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          AUTH_SECRET: 'secret-123',
          API_URL: 'http://localhost:8000',
          REDIS_HOST: 'redis-host',
          REDIS_PORT: '6379',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(false, mockRootDir);

      expect(result).toEqual({
        AUTH_SECRET: 'secret-123',
        API_URL: 'http://localhost:8000',
        REDIS_HOST: 'redis-host',
        REDIS_PORT: '6379',
      });
    });
  });

  describe('Service-specific secrets', () => {
    it('should extract service-specific environment variables', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          AUTH_SECRET: 'secret-123',
        },
        'auth-service': {
          secrets: ['AUTH_SECRET'],
          API_KEY: 'AUTH_SERVICE_API_KEY',
          ALLOWED_ORIGINS: 'http://localhost:3000',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(false, mockRootDir);

      expect(result).toEqual({
        AUTH_SECRET: 'secret-123',
        API_KEY: 'AUTH_SERVICE_API_KEY',
        ALLOWED_ORIGINS: 'http://localhost:3000',
      });
    });

    it('should skip service secrets arrays', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          API_KEY: 'key-123',
        },
        'user-service': {
          secrets: ['API_KEY', 'DATABASE_URL'],
          DATABASE_URL: 'postgresql://localhost/db',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(false, mockRootDir);

      // Should not include the 'secrets' array itself
      expect(result).toEqual({
        API_KEY: 'key-123',
        DATABASE_URL: 'postgresql://localhost/db',
      });
      expect(result).not.toHaveProperty('secrets');
    });

    it('should handle multiple services', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          AUTH_SECRET: 'secret-123',
        },
        'auth-service': {
          secrets: [],
          AUTH_SERVICE_API_KEY: 'auth-key',
        },
        'user-service': {
          secrets: [],
          USER_SERVICE_API_KEY: 'user-key',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(false, mockRootDir);

      expect(result).toEqual({
        AUTH_SECRET: 'secret-123',
        AUTH_SERVICE_API_KEY: 'auth-key',
        USER_SERVICE_API_KEY: 'user-key',
      });
    });
  });

  describe('Metadata field skipping', () => {
    it('should skip $comment metadata', () => {
      const mockSecretsFile: SecretsFile = {
        $comment: 'Auto-generated secrets',
        secrets: {
          API_KEY: 'test-key',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(false, mockRootDir);

      expect(result).toEqual({
        API_KEY: 'test-key',
      });
      expect(result).not.toHaveProperty('$comment');
    });

    it('should skip all $ metadata fields', () => {
      const mockSecretsFile: SecretsFile = {
        $comment: 'Comment',
        $warning: 'Warning',
        $generated_at: '2024-01-01T00:00:00.000Z',
        secrets: {
          API_KEY: 'test-key',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(false, mockRootDir);

      expect(result).toEqual({
        API_KEY: 'test-key',
      });
      expect(result).not.toHaveProperty('$comment');
      expect(result).not.toHaveProperty('$warning');
      expect(result).not.toHaveProperty('$generated_at');
    });
  });

  describe('DB password extraction', () => {
    it('should not extract DB passwords by default', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
          DATABASE_URL: 'postgresql://authuser:authpass@localhost:5432/auth',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(false, mockRootDir);

      expect(result).toEqual({
        DATABASE_URL: 'postgresql://authuser:authpass@localhost:5432/auth',
      });
      expect(result).not.toHaveProperty('AUTH_DB_PASSWORD');
      expect(result).not.toHaveProperty('AUTH_DB_USER');
    });

    it('should extract DB passwords when enabled', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
          DATABASE_URL: 'postgresql://authuser:authpass@localhost:5432/auth',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(true, mockRootDir);

      expect(result).toEqual({
        DATABASE_URL: 'postgresql://authuser:authpass@localhost:5432/auth',
        AUTH_DB_PASSWORD: 'authpass',
        AUTH_DB_USER: 'authuser',
      });
    });

    it('should handle service names with -service suffix', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'user-service': {
          secrets: [],
          DATABASE_URL: 'postgresql://userdb:userpass@localhost:5432/user',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(true, mockRootDir);

      expect(result.USER_DB_PASSWORD).toBe('userpass');
      expect(result.USER_DB_USER).toBe('userdb');
    });

    it('should handle kebab-case service names', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'my-complex-service': {
          secrets: [],
          DATABASE_URL: 'postgresql://myuser:mypass@localhost:5432/mydb',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(true, mockRootDir);

      expect(result.MY_COMPLEX_DB_PASSWORD).toBe('mypass');
      expect(result.MY_COMPLEX_DB_USER).toBe('myuser');
    });

    it('should extract DB passwords from multiple services', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
          DATABASE_URL: 'postgresql://authuser:authpass@localhost:5432/auth',
        },
        'user-service': {
          secrets: [],
          DATABASE_URL: 'postgresql://useruser:userpass@localhost:5432/user',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(true, mockRootDir);

      expect(result.AUTH_DB_PASSWORD).toBe('authpass');
      expect(result.AUTH_DB_USER).toBe('authuser');
      expect(result.USER_DB_PASSWORD).toBe('userpass');
      expect(result.USER_DB_USER).toBe('useruser');
    });

    it('should handle DATABASE_URL with special characters in password', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
          DATABASE_URL: 'postgresql://user:p!ssw0rd@localhost:5432/db',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(true, mockRootDir);

      expect(result.AUTH_DB_PASSWORD).toBe('p!ssw0rd');
      expect(result.AUTH_DB_USER).toBe('user');
    });
  });

  describe('Error handling', () => {
    it('should throw CliError when file does not exist', () => {
      rs.mocked(fsModule.readJsonFile).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => loadLocalSecrets(false, mockRootDir)).toThrow(CliError);
    });

    it('should include helpful error message', () => {
      rs.mocked(fsModule.readJsonFile).mockImplementation(() => {
        throw new Error('File not found');
      });

      try {
        loadLocalSecrets(false, mockRootDir);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('.secrets.local.json');
      }
    });

    it('should throw CliError on invalid JSON', () => {
      rs.mocked(fsModule.readJsonFile).mockImplementation(() => {
        throw new SyntaxError('Unexpected token in JSON');
      });

      expect(() => loadLocalSecrets(false, mockRootDir)).toThrow(CliError);
    });
  });

  describe('Default parameters', () => {
    it('should use findProjectRoot when rootDir not provided', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          API_KEY: 'test-key',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      loadLocalSecrets();

      expect(pathsModule.findProjectRoot).toHaveBeenCalled();
      expect(fsModule.readJsonFile).toHaveBeenCalledWith(
        `${mockRootDir}/.secrets.local.json`,
      );
    });

    it('should default extractDbPasswords to false', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets();

      expect(result).not.toHaveProperty('AUTH_DB_PASSWORD');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty secrets object', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {},
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(false, mockRootDir);

      expect(result).toEqual({});
    });

    it('should handle missing secrets field', () => {
      const mockSecretsFile = {} as SecretsFile;

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(false, mockRootDir);

      expect(result).toEqual({});
    });

    it('should skip non-object service configs', () => {
      const mockSecretsFile = {
        secrets: {
          API_KEY: 'key-123',
        },
        'invalid-service': 'not an object',
      } as unknown as SecretsFile;

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(false, mockRootDir);

      expect(result).toEqual({
        API_KEY: 'key-123',
      });
    });

    it('should skip null service configs', () => {
      const mockSecretsFile = {
        secrets: {
          API_KEY: 'key-123',
        },
        'null-service': null,
      } as unknown as SecretsFile;

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(false, mockRootDir);

      expect(result).toEqual({
        API_KEY: 'key-123',
      });
    });

    it('should not flatten arrays in nested objects', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          SOME_CONFIG: {
            KEY1: 'value1',
            KEY2: 'value2',
          } as unknown as string,
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(false, mockRootDir);

      expect(result).toEqual({
        KEY1: 'value1',
        KEY2: 'value2',
      });
    });

    it('should handle non-string nested values', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          CONFIG: {
            STRING_VAL: 'value',
            NUMBER_VAL: 123,
            BOOL_VAL: true,
          } as unknown as string,
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecrets(false, mockRootDir);

      // Only string values should be extracted
      expect(result).toEqual({
        STRING_VAL: 'value',
      });
      expect(result).not.toHaveProperty('NUMBER_VAL');
      expect(result).not.toHaveProperty('BOOL_VAL');
    });
  });

  describe('File path construction', () => {
    it('should construct correct file path', () => {
      rs.mocked(fsModule.readJsonFile).mockReturnValue({ secrets: {} });

      loadLocalSecrets(false, '/custom/path');

      expect(fsModule.readJsonFile).toHaveBeenCalledWith(
        '/custom/path/.secrets.local.json',
      );
    });
  });
});
