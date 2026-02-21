import { describe, it, expect } from '@rstest/core';
import { getRequiredSecret } from './get-required-secret';
import { CliError } from '../errors';

describe('getRequiredSecret', () => {
  describe('Successful retrieval', () => {
    it('should return the secret value when it exists', () => {
      const secrets = {
        API_KEY: 'test-api-key-123',
        DATABASE_URL: 'postgresql://localhost/db',
      };

      const result = getRequiredSecret(secrets, 'API_KEY');

      expect(result).toBe('test-api-key-123');
    });

    it('should return values with special characters', () => {
      const secrets = {
        PASSWORD: 'p@ssw0rd!#$%',
      };

      const result = getRequiredSecret(secrets, 'PASSWORD');

      expect(result).toBe('p@ssw0rd!#$%');
    });

    it('should return URL values', () => {
      const secrets = {
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      };

      const result = getRequiredSecret(secrets, 'DATABASE_URL');

      expect(result).toBe('postgresql://user:pass@localhost:5432/db');
    });

    it('should return long secret values', () => {
      const secrets = {
        JWT_SECRET: 'a'.repeat(256),
      };

      const result = getRequiredSecret(secrets, 'JWT_SECRET');

      expect(result).toBe('a'.repeat(256));
    });
  });

  describe('Missing secrets', () => {
    it('should throw CliError when secret is missing', () => {
      const secrets = {
        API_KEY: 'test-key',
      };

      expect(() => getRequiredSecret(secrets, 'DATABASE_URL')).toThrow(
        CliError,
      );
    });

    it('should throw error with correct message for missing secret', () => {
      const secrets = {
        API_KEY: 'test-key',
      };

      expect(() => getRequiredSecret(secrets, 'AUTH_SECRET')).toThrow(
        'Expected AUTH_SECRET in .secrets.local.json',
      );
    });

    it('should throw error with structured information', () => {
      const secrets = {
        API_KEY: 'test-key',
      };

      try {
        getRequiredSecret(secrets, 'DATABASE_URL');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain(
          'Expected DATABASE_URL in .secrets.local.json',
        );
      }
    });

    it('should throw error when secret key does not exist', () => {
      const secrets = {};

      expect(() => getRequiredSecret(secrets, 'MISSING_KEY')).toThrow(CliError);
    });
  });

  describe('Empty string handling', () => {
    it('should throw error for empty string values', () => {
      const secrets = {
        EMPTY_SECRET: '',
      };

      expect(() => getRequiredSecret(secrets, 'EMPTY_SECRET')).toThrow(
        CliError,
      );
    });

    it('should throw error message for empty string', () => {
      const secrets = {
        EMPTY_KEY: '',
      };

      expect(() => getRequiredSecret(secrets, 'EMPTY_KEY')).toThrow(
        'Expected EMPTY_KEY in .secrets.local.json',
      );
    });
  });

  describe('Custom error messages', () => {
    it('should use custom error message when provided', () => {
      const secrets = {
        API_KEY: 'test-key',
      };

      expect(() =>
        getRequiredSecret(
          secrets,
          'DATABASE_URL',
          'Custom error: Database URL is required',
        ),
      ).toThrow('Custom error: Database URL is required');
    });

    it('should throw CliError with custom message', () => {
      const secrets = {};

      try {
        getRequiredSecret(
          secrets,
          'MISSING_KEY',
          'Please configure MISSING_KEY in your secrets',
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).message).toBe(
          'Please configure MISSING_KEY in your secrets',
        );
      }
    });

    it('should use custom error message for empty strings', () => {
      const secrets = {
        EMPTY_VAR: '',
      };

      expect(() =>
        getRequiredSecret(secrets, 'EMPTY_VAR', 'EMPTY_VAR cannot be empty'),
      ).toThrow('EMPTY_VAR cannot be empty');
    });
  });

  describe('Multiple secrets', () => {
    it('should retrieve different secrets from the same object', () => {
      const secrets = {
        API_KEY: 'key-123',
        DATABASE_URL: 'postgresql://localhost/db',
        REDIS_URL: 'redis://localhost:6379',
        AUTH_SECRET: 'secret-456',
      };

      expect(getRequiredSecret(secrets, 'API_KEY')).toBe('key-123');
      expect(getRequiredSecret(secrets, 'DATABASE_URL')).toBe(
        'postgresql://localhost/db',
      );
      expect(getRequiredSecret(secrets, 'REDIS_URL')).toBe(
        'redis://localhost:6379',
      );
      expect(getRequiredSecret(secrets, 'AUTH_SECRET')).toBe('secret-456');
    });
  });

  describe('Edge cases', () => {
    it('should handle secrets with whitespace values', () => {
      const secrets = {
        WHITESPACE_SECRET: '  value with spaces  ',
      };

      const result = getRequiredSecret(secrets, 'WHITESPACE_SECRET');

      expect(result).toBe('  value with spaces  ');
    });

    it('should handle secrets with newlines', () => {
      const secrets = {
        MULTILINE_SECRET: 'line1\nline2\nline3',
      };

      const result = getRequiredSecret(secrets, 'MULTILINE_SECRET');

      expect(result).toBe('line1\nline2\nline3');
    });

    it('should handle numeric-looking string values', () => {
      const secrets = {
        PORT: '3000',
        MAX_CONNECTIONS: '100',
      };

      expect(getRequiredSecret(secrets, 'PORT')).toBe('3000');
      expect(getRequiredSecret(secrets, 'MAX_CONNECTIONS')).toBe('100');
    });

    it('should handle boolean-looking string values', () => {
      const secrets = {
        ENABLED: 'true',
        DISABLED: 'false',
      };

      expect(getRequiredSecret(secrets, 'ENABLED')).toBe('true');
      expect(getRequiredSecret(secrets, 'DISABLED')).toBe('false');
    });

    it('should be case-sensitive for keys', () => {
      const secrets = {
        api_key: 'lowercase',
        API_KEY: 'uppercase',
      };

      expect(getRequiredSecret(secrets, 'api_key')).toBe('lowercase');
      expect(getRequiredSecret(secrets, 'API_KEY')).toBe('uppercase');
    });

    it('should handle keys with special characters', () => {
      const secrets = {
        'MY-SERVICE_API_KEY': 'value-123',
      };

      const result = getRequiredSecret(secrets, 'MY-SERVICE_API_KEY');

      expect(result).toBe('value-123');
    });
  });
});
