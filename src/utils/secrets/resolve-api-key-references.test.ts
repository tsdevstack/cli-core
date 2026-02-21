import { describe, it, expect } from '@rstest/core';
import { resolveApiKeyReferences } from './resolve-api-key-references';
import type { SecretsFile } from './types';

describe('resolveApiKeyReferences', () => {
  describe('Basic API_KEY resolution', () => {
    it('should resolve API_KEY reference to actual value', () => {
      const input: SecretsFile = {
        secrets: {
          AUTH_SERVICE_API_KEY: 'actual-auth-key-value',
        },
        'auth-service': {
          secrets: [],
          API_KEY: 'AUTH_SERVICE_API_KEY',
        },
      };

      const result = resolveApiKeyReferences(input);

      const authService = result['auth-service'] as Record<string, unknown>;
      expect(authService.API_KEY).toBe('actual-auth-key-value');
    });

    it('should resolve multiple service API_KEYs', () => {
      const input: SecretsFile = {
        secrets: {
          AUTH_SERVICE_API_KEY: 'auth-key-123',
          USER_SERVICE_API_KEY: 'user-key-456',
        },
        'auth-service': {
          secrets: [],
          API_KEY: 'AUTH_SERVICE_API_KEY',
        },
        'user-service': {
          secrets: [],
          API_KEY: 'USER_SERVICE_API_KEY',
        },
      };

      const result = resolveApiKeyReferences(input);

      const authService = result['auth-service'] as Record<string, unknown>;
      const userService = result['user-service'] as Record<string, unknown>;
      expect(authService.API_KEY).toBe('auth-key-123');
      expect(userService.API_KEY).toBe('user-key-456');
    });
  });

  describe('Already resolved API_KEYs', () => {
    it('should not modify already resolved API_KEY', () => {
      const input: SecretsFile = {
        secrets: {
          AUTH_SERVICE_API_KEY: 'actual-auth-key',
        },
        'auth-service': {
          secrets: [],
          API_KEY: 'already-resolved-value',
        },
      };

      const result = resolveApiKeyReferences(input);

      const authService = result['auth-service'] as Record<string, unknown>;
      expect(authService.API_KEY).toBe('already-resolved-value');
    });

    it('should keep API_KEY if reference not found in secrets', () => {
      const input: SecretsFile = {
        secrets: {
          OTHER_KEY: 'some-value',
        },
        'auth-service': {
          secrets: [],
          API_KEY: 'NON_EXISTENT_KEY',
        },
      };

      const result = resolveApiKeyReferences(input);

      const authService = result['auth-service'] as Record<string, unknown>;
      expect(authService.API_KEY).toBe('NON_EXISTENT_KEY');
    });
  });

  describe('Metadata handling', () => {
    it('should skip metadata keys starting with $', () => {
      const input: SecretsFile = {
        $comment: 'test comment',
        $warning: 'test warning',
        secrets: {
          AUTH_SERVICE_API_KEY: 'auth-key',
        },
        'auth-service': {
          secrets: [],
          API_KEY: 'AUTH_SERVICE_API_KEY',
        },
      };

      const result = resolveApiKeyReferences(input);

      expect(result.$comment).toBe('test comment');
      expect(result.$warning).toBe('test warning');
      const authService = result['auth-service'] as Record<string, unknown>;
      expect(authService.API_KEY).toBe('auth-key');
    });

    it('should not process secrets object itself', () => {
      const input: SecretsFile = {
        secrets: {
          AUTH_SERVICE_API_KEY: 'auth-key',
          API_KEY: 'should-not-be-processed',
        },
      };

      const result = resolveApiKeyReferences(input);

      expect(result.secrets.API_KEY).toBe('should-not-be-processed');
    });
  });

  describe('Services without API_KEY', () => {
    it('should not modify services without API_KEY', () => {
      const input: SecretsFile = {
        secrets: {
          AUTH_SERVICE_API_KEY: 'auth-key',
        },
        'web-service': {
          secrets: [],
          PORT: '3000',
        },
      };

      const result = resolveApiKeyReferences(input);

      const webService = result['web-service'] as Record<string, unknown>;
      expect(webService.PORT).toBe('3000');
      expect(webService.API_KEY).toBeUndefined();
    });

    it('should handle mix of services with and without API_KEY', () => {
      const input: SecretsFile = {
        secrets: {
          AUTH_SERVICE_API_KEY: 'auth-key',
        },
        'auth-service': {
          secrets: [],
          API_KEY: 'AUTH_SERVICE_API_KEY',
          PORT: '3001',
        },
        'web-service': {
          secrets: [],
          PORT: '3000',
        },
      };

      const result = resolveApiKeyReferences(input);

      const authService = result['auth-service'] as Record<string, unknown>;
      const webService = result['web-service'] as Record<string, unknown>;
      expect(authService.API_KEY).toBe('auth-key');
      expect(authService.PORT).toBe('3001');
      expect(webService.API_KEY).toBeUndefined();
      expect(webService.PORT).toBe('3000');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty secrets object', () => {
      const input: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
          API_KEY: 'AUTH_SERVICE_API_KEY',
        },
      };

      const result = resolveApiKeyReferences(input);

      const authService = result['auth-service'] as Record<string, unknown>;
      expect(authService.API_KEY).toBe('AUTH_SERVICE_API_KEY');
    });

    it('should handle missing secrets object', () => {
      const input: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
          API_KEY: 'AUTH_SERVICE_API_KEY',
        },
      };

      delete (input as { secrets?: unknown }).secrets;

      const result = resolveApiKeyReferences(input);

      const authService = result['auth-service'] as Record<string, unknown>;
      expect(authService.API_KEY).toBe('AUTH_SERVICE_API_KEY');
    });

    it('should handle non-object service sections', () => {
      const input: SecretsFile = {
        secrets: {
          AUTH_SERVICE_API_KEY: 'auth-key',
        },
        'string-value': 'test',
        'number-value': 123,
      };

      const result = resolveApiKeyReferences(input);

      expect(result['string-value']).toBe('test');
      expect(result['number-value']).toBe(123);
    });

    it('should handle null service sections', () => {
      const input: SecretsFile = {
        secrets: {
          AUTH_SERVICE_API_KEY: 'auth-key',
        },
        'null-service': null,
      };

      const result = resolveApiKeyReferences(input);

      expect(result['null-service']).toBeNull();
    });

    it('should handle array service sections', () => {
      const input: SecretsFile = {
        secrets: {
          AUTH_SERVICE_API_KEY: 'auth-key',
        },
        'array-service': ['item1', 'item2'],
      };

      const result = resolveApiKeyReferences(input);

      expect(result['array-service']).toEqual(['item1', 'item2']);
    });

    it('should handle API_KEY with non-string value', () => {
      const input: SecretsFile = {
        secrets: {
          AUTH_SERVICE_API_KEY: 'auth-key',
        },
        'auth-service': {
          secrets: [],
          API_KEY: 123,
        },
      };

      const result = resolveApiKeyReferences(input);

      const authService = result['auth-service'] as Record<string, unknown>;
      expect(authService.API_KEY).toBe(123);
    });
  });

  describe('Return value', () => {
    it('should return the same secrets file reference (mutated)', () => {
      const input: SecretsFile = {
        secrets: {
          AUTH_SERVICE_API_KEY: 'auth-key',
        },
        'auth-service': {
          secrets: [],
          API_KEY: 'AUTH_SERVICE_API_KEY',
        },
      };

      const result = resolveApiKeyReferences(input);

      expect(result).toBe(input);
    });

    it('should maintain all other properties', () => {
      const input: SecretsFile = {
        $comment: 'test',
        $generated_at: '2024-01-01',
        secrets: {
          AUTH_SERVICE_API_KEY: 'auth-key',
          OTHER_SECRET: 'other-value',
        },
        'auth-service': {
          secrets: ['AUTH_SERVICE_API_KEY'],
          API_KEY: 'AUTH_SERVICE_API_KEY',
          PORT: '3001',
          DATABASE_URL: 'postgresql://...',
        },
      };

      const result = resolveApiKeyReferences(input);

      expect(result.$comment).toBe('test');
      expect(result.$generated_at).toBe('2024-01-01');
      expect(result.secrets.OTHER_SECRET).toBe('other-value');

      const authService = result['auth-service'] as Record<string, unknown>;
      expect(authService.PORT).toBe('3001');
      expect(authService.DATABASE_URL).toBe('postgresql://...');
      expect(authService.secrets).toEqual(['AUTH_SERVICE_API_KEY']);
    });
  });
});
