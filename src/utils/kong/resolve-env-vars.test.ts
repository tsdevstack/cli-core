import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { resolveEnvVars } from './resolve-env-vars';

// Mock logger
rs.mock('../logger', () => ({
  logger: {
    warn: rs.fn(),
  },
}));

describe('resolveEnvVars', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('String replacement', () => {
    it('should replace single placeholder with secret value', () => {
      const input = '${API_KEY}';
      const secrets = { API_KEY: 'secret-123' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe('secret-123');
    });

    it('should replace multiple placeholders in same string', () => {
      const input = 'postgres://${DB_USER}:${DB_PASSWORD}@localhost/db';
      const secrets = {
        DB_USER: 'admin',
        DB_PASSWORD: 'pass123',
      };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe('postgres://admin:pass123@localhost/db');
    });

    it('should handle placeholder at start of string', () => {
      const input = '${PREFIX}/path/to/resource';
      const secrets = { PREFIX: '/api/v1' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe('/api/v1/path/to/resource');
    });

    it('should handle placeholder at end of string', () => {
      const input = 'https://api.example.com/${ENDPOINT}';
      const secrets = { ENDPOINT: 'users' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe('https://api.example.com/users');
    });

    it('should handle placeholder with underscores in name', () => {
      const input = '${PARTNER_API_KEY}';
      const secrets = { PARTNER_API_KEY: 'key-abc' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe('key-abc');
    });

    it('should handle string without placeholders', () => {
      const input = 'plain string';
      const secrets = { KEY: 'value' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe('plain string');
    });

    it('should handle empty string', () => {
      const input = '';
      const secrets = { KEY: 'value' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe('');
    });
  });

  describe('Missing secrets handling', () => {
    it('should keep placeholder if secret not found', () => {
      const input = '${MISSING_KEY}';
      const secrets = { OTHER_KEY: 'value' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe('${MISSING_KEY}');
    });

    it('should warn when secret not found', async () => {
      const { logger } = await import('../logger');
      const input = '${MISSING_KEY}';
      const secrets = {};

      resolveEnvVars(input, secrets);

      expect(logger.warn).toHaveBeenCalledWith(
        'MISSING_KEY not found in secrets, keeping placeholder',
      );
    });

    it('should replace found secrets and keep missing ones', () => {
      const input = '${FOUND_KEY} and ${MISSING_KEY}';
      const secrets = { FOUND_KEY: 'value1' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe('value1 and ${MISSING_KEY}');
    });
  });

  describe('Array handling', () => {
    it('should resolve placeholders in array of strings', () => {
      const input = ['${KEY1}', '${KEY2}', 'plain'];
      const secrets = {
        KEY1: 'value1',
        KEY2: 'value2',
      };

      const result = resolveEnvVars(input, secrets);

      expect(result).toEqual(['value1', 'value2', 'plain']);
    });

    it('should handle empty array', () => {
      const input: string[] = [];
      const secrets = { KEY: 'value' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toEqual([]);
    });

    it('should handle nested arrays', () => {
      const input = [['${KEY1}'], ['${KEY2}']];
      const secrets = {
        KEY1: 'value1',
        KEY2: 'value2',
      };

      const result = resolveEnvVars(input, secrets);

      expect(result).toEqual([['value1'], ['value2']]);
    });

    it('should handle mixed types in array', () => {
      const input = ['${KEY}', 123, true, null];
      const secrets = { KEY: 'value' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toEqual(['value', 123, true, null]);
    });
  });

  describe('Object handling', () => {
    it('should resolve placeholders in object values', () => {
      const input = {
        username: '${DB_USER}',
        password: '${DB_PASSWORD}',
      };
      const secrets = {
        DB_USER: 'admin',
        DB_PASSWORD: 'secret',
      };

      const result = resolveEnvVars(input, secrets);

      expect(result).toEqual({
        username: 'admin',
        password: 'secret',
      });
    });

    it('should handle nested objects', () => {
      const input = {
        database: {
          host: 'localhost',
          credentials: {
            user: '${DB_USER}',
            pass: '${DB_PASS}',
          },
        },
      };
      const secrets = {
        DB_USER: 'admin',
        DB_PASS: 'secret',
      };

      const result = resolveEnvVars(input, secrets);

      expect(result).toEqual({
        database: {
          host: 'localhost',
          credentials: {
            user: 'admin',
            pass: 'secret',
          },
        },
      });
    });

    it('should handle empty object', () => {
      const input = {};
      const secrets = { KEY: 'value' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toEqual({});
    });

    it('should handle objects with arrays', () => {
      const input = {
        keys: ['${KEY1}', '${KEY2}'],
        urls: ['${URL}'],
      };
      const secrets = {
        KEY1: 'value1',
        KEY2: 'value2',
        URL: 'http://example.com',
      };

      const result = resolveEnvVars(input, secrets);

      expect(result).toEqual({
        keys: ['value1', 'value2'],
        urls: ['http://example.com'],
      });
    });
  });

  describe('Primitive types', () => {
    it('should return numbers unchanged', () => {
      const input = 123;
      const secrets = { KEY: 'value' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe(123);
    });

    it('should return booleans unchanged', () => {
      const input = true;
      const secrets = { KEY: 'value' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe(true);
    });

    it('should return null unchanged', () => {
      const input = null;
      const secrets = { KEY: 'value' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe(null);
    });
  });

  describe('Numeric conversion for single placeholders', () => {
    it('should convert numeric string to integer for single placeholder', () => {
      const input = '${REDIS_PORT}';
      const secrets = { REDIS_PORT: '6379' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe(6379);
      expect(typeof result).toBe('number');
    });

    it('should not convert non-numeric strings', () => {
      const input = '${API_KEY}';
      const secrets = { API_KEY: 'secret-123' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe('secret-123');
      expect(typeof result).toBe('string');
    });

    it('should not convert embedded numeric placeholders', () => {
      const input = 'port:${PORT}';
      const secrets = { PORT: '8080' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe('port:8080');
      expect(typeof result).toBe('string');
    });

    it('should convert zero to number', () => {
      const input = '${DATABASE}';
      const secrets = { DATABASE: '0' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe(0);
      expect(typeof result).toBe('number');
    });

    it('should handle Redis config with numeric port', () => {
      const input = {
        redis: {
          host: '${REDIS_HOST}',
          port: '${REDIS_PORT}',
          password: '${REDIS_PASSWORD}',
          database: 0,
          timeout: 2000,
        },
      };
      const secrets = {
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_PASSWORD: 'redis_pass',
      };

      const result = resolveEnvVars(input, secrets);

      expect(result).toEqual({
        redis: {
          host: 'localhost',
          port: 6379, // number, not string
          password: 'redis_pass',
          database: 0,
          timeout: 2000,
        },
      });
    });
  });

  describe('Real-world Kong config scenarios', () => {
    it('should resolve Kong consumer credentials', () => {
      const input = {
        consumers: [
          {
            username: 'partner-a',
            keyauth_credentials: [
              {
                key: '${PARTNER_A_API_KEY}',
              },
            ],
          },
          {
            username: 'partner-b',
            keyauth_credentials: [
              {
                key: '${PARTNER_B_API_KEY}',
              },
            ],
          },
        ],
      };

      const secrets = {
        PARTNER_A_API_KEY: 'key-abc-123',
        PARTNER_B_API_KEY: 'key-xyz-789',
      };

      const result = resolveEnvVars(input, secrets);

      expect(result).toEqual({
        consumers: [
          {
            username: 'partner-a',
            keyauth_credentials: [
              {
                key: 'key-abc-123',
              },
            ],
          },
          {
            username: 'partner-b',
            keyauth_credentials: [
              {
                key: 'key-xyz-789',
              },
            ],
          },
        ],
      });
    });

    it('should resolve service URLs with placeholders', () => {
      const input = {
        services: [
          {
            name: 'auth-service',
            url: '${AUTH_SERVICE_URL}',
            routes: [
              {
                paths: ['/auth'],
              },
            ],
          },
        ],
      };

      const secrets = {
        AUTH_SERVICE_URL: 'http://auth:3001',
      };

      const result = resolveEnvVars(input, secrets);

      expect(result).toEqual({
        services: [
          {
            name: 'auth-service',
            url: 'http://auth:3001',
            routes: [
              {
                paths: ['/auth'],
              },
            ],
          },
        ],
      });
    });

    it('should resolve plugin configurations', () => {
      const input = {
        plugins: [
          {
            name: 'cors',
            config: {
              origins: ['${FRONTEND_URL}', '${ADMIN_URL}'],
              credentials: true,
            },
          },
        ],
      };

      const secrets = {
        FRONTEND_URL: 'http://localhost:3000',
        ADMIN_URL: 'http://localhost:3001',
      };

      const result = resolveEnvVars(input, secrets);

      expect(result).toEqual({
        plugins: [
          {
            name: 'cors',
            config: {
              origins: ['http://localhost:3000', 'http://localhost:3001'],
              credentials: true,
            },
          },
        ],
      });
    });

    it('should handle complex nested Kong template', () => {
      const input = {
        _format_version: '3.0',
        services: [
          {
            name: 'api',
            url: '${API_URL}',
          },
        ],
        consumers: [
          {
            username: 'partner',
            keyauth_credentials: [{ key: '${PARTNER_KEY}' }],
          },
        ],
        plugins: [
          {
            name: 'rate-limiting',
            config: {
              minute: 100,
            },
          },
        ],
      };

      const secrets = {
        API_URL: 'http://api:3000',
        PARTNER_KEY: 'secret-key-123',
      };

      const result = resolveEnvVars(input, secrets);

      expect(result).toEqual({
        _format_version: '3.0',
        services: [
          {
            name: 'api',
            url: 'http://api:3000',
          },
        ],
        consumers: [
          {
            username: 'partner',
            keyauth_credentials: [{ key: 'secret-key-123' }],
          },
        ],
        plugins: [
          {
            name: 'rate-limiting',
            config: {
              minute: 100,
            },
          },
        ],
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle placeholder with no closing brace', () => {
      const input = '${INCOMPLETE';
      const secrets = { INCOMPLETE: 'value' };

      const result = resolveEnvVars(input, secrets);

      // Regex won't match incomplete placeholder
      expect(result).toBe('${INCOMPLETE');
    });

    it('should handle nested placeholders (outer only)', () => {
      const input = '${KEY_${NESTED}}';
      const secrets = { 'KEY_${NESTED}': 'value' };

      const result = resolveEnvVars(input, secrets);

      // Regex will match the outer placeholder including the inner syntax
      expect(result).toBe('${KEY_${NESTED}}');
    });

    it('should handle empty placeholder', () => {
      const input = '${}';
      const secrets = { '': 'value' };

      const result = resolveEnvVars(input, secrets);

      // Empty var name - will keep placeholder since secrets[''] is undefined
      expect(result).toBe('${}');
    });

    it('should handle placeholder with spaces', () => {
      const input = '${ KEY }';
      const secrets = { ' KEY ': 'value' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe('value');
    });

    it('should handle secret value that is empty string', () => {
      const input = '${EMPTY_KEY}';
      const secrets = { EMPTY_KEY: '' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe('');
    });

    it('should handle very long placeholder names', () => {
      const longName = 'A'.repeat(100);
      const input = `\${${longName}}`;
      const secrets = { [longName]: 'value' };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe('value');
    });

    it('should handle multiple consecutive placeholders', () => {
      const input = '${KEY1}${KEY2}${KEY3}';
      const secrets = {
        KEY1: 'a',
        KEY2: 'b',
        KEY3: 'c',
      };

      const result = resolveEnvVars(input, secrets);

      expect(result).toBe('abc');
    });
  });

  describe('Immutability', () => {
    it('should not mutate original object', () => {
      const input = {
        key: '${VALUE}',
        nested: {
          value: '${NESTED_VALUE}',
        },
      };
      const secrets = {
        VALUE: 'new-value',
        NESTED_VALUE: 'nested-new',
      };

      const originalInput = JSON.parse(JSON.stringify(input));

      resolveEnvVars(input, secrets);

      // Original should be unchanged
      expect(input).toEqual(originalInput);
    });

    it('should not mutate original array', () => {
      const input = ['${KEY1}', '${KEY2}'];
      const secrets = { KEY1: 'value1', KEY2: 'value2' };

      const originalInput = [...input];

      resolveEnvVars(input, secrets);

      expect(input).toEqual(originalInput);
    });
  });
});
