import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { mergeSecrets } from './merge-secrets';
import type { SecretsFile } from './types';
import * as resolveApiKeyReferencesModule from './resolve-api-key-references';

// Mock the resolve function
rs.mock('./resolve-api-key-references', { mock: true });

describe('mergeSecrets', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    // Default: return input unchanged (we'll test resolution separately)
    rs.mocked(
      resolveApiKeyReferencesModule.resolveApiKeyReferences,
    ).mockImplementation((input) => input);
  });

  describe('Basic merging', () => {
    it('should merge framework and user secrets', () => {
      const framework: SecretsFile = {
        secrets: {
          AUTH_SECRET: 'framework-auth',
        },
        'auth-service': {
          secrets: [],
          PORT: '3001',
        },
      };

      const user: SecretsFile = {
        secrets: {
          USER_KEY: 'user-value',
        },
        'auth-service': {
          secrets: [],
          ALLOWED_ORIGINS: 'http://localhost:3000',
        },
      };

      const result = mergeSecrets(framework, user);

      expect(result.secrets).toEqual({
        AUTH_SECRET: 'framework-auth',
        USER_KEY: 'user-value',
      });

      const authService = result['auth-service'] as Record<string, unknown>;
      expect(authService.PORT).toBe('3001');
      expect(authService.ALLOWED_ORIGINS).toBe('http://localhost:3000');
    });

    it('should give user values precedence over framework', () => {
      const framework: SecretsFile = {
        secrets: {
          AUTH_SECRET: 'framework-value',
        },
      };

      const user: SecretsFile = {
        secrets: {
          AUTH_SECRET: 'user-value',
        },
      };

      const result = mergeSecrets(framework, user);

      expect(result.secrets.AUTH_SECRET).toBe('user-value');
    });

    it('should preserve framework values when not in user', () => {
      const framework: SecretsFile = {
        secrets: {
          AUTH_SECRET: 'framework-auth',
          FRAMEWORK_ONLY: 'framework-value',
        },
      };

      const user: SecretsFile = {
        secrets: {
          USER_ONLY: 'user-value',
        },
      };

      const result = mergeSecrets(framework, user);

      expect(result.secrets).toEqual({
        AUTH_SECRET: 'framework-auth',
        FRAMEWORK_ONLY: 'framework-value',
        USER_ONLY: 'user-value',
      });
    });
  });

  describe('Shallow merging (no nested objects)', () => {
    it('should handle flat REDIS secrets (no nesting)', () => {
      const framework: SecretsFile = {
        secrets: {
          REDIS_HOST: 'localhost',
          REDIS_PORT: '6379',
        },
      };

      const user: SecretsFile = {
        secrets: {
          REDIS_PASSWORD: 'custom-password',
        },
      };

      const result = mergeSecrets(framework, user);

      expect(result.secrets).toEqual({
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379',
        REDIS_PASSWORD: 'custom-password',
      });
    });

    it('should shallow merge service sections', () => {
      const framework: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
          PORT: '3001',
          DATABASE_URL: 'postgresql://...',
        },
      };

      const user: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
          ALLOWED_ORIGINS: 'http://localhost:3000',
        },
      };

      const result = mergeSecrets(framework, user);

      const authService = result['auth-service'] as Record<string, unknown>;
      expect(authService).toEqual({
        PORT: '3001',
        DATABASE_URL: 'postgresql://...',
        ALLOWED_ORIGINS: 'http://localhost:3000',
      });
    });
  });

  describe('Metadata handling', () => {
    it('should skip metadata keys from user', () => {
      const framework: SecretsFile = {
        $comment: 'framework comment',
        secrets: {},
      };

      const user: SecretsFile = {
        $comment: 'user comment',
        $warning: 'user warning',
        secrets: {},
      };

      const result = mergeSecrets(framework, user);

      expect(result.$comment).toBe('framework comment');
      expect(result.$warning).toBeUndefined();
    });

    it('should preserve framework metadata', () => {
      const framework: SecretsFile = {
        $comment: 'AUTO-GENERATED',
        $generated_at: '2024-01-01',
        secrets: {},
      };

      const user: SecretsFile = {
        secrets: {},
      };

      const result = mergeSecrets(framework, user);

      expect(result.$comment).toBe('AUTO-GENERATED');
      expect(result.$generated_at).toBe('2024-01-01');
    });
  });

  describe('Service additions', () => {
    it('should add new services from user', () => {
      const framework: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
          PORT: '3001',
        },
      };

      const user: SecretsFile = {
        secrets: {},
        'payment-service': {
          secrets: [],
          STRIPE_KEY: 'sk_...',
        },
      };

      const result = mergeSecrets(framework, user);

      expect(result['auth-service']).toBeDefined();
      expect(result['payment-service']).toBeDefined();

      const paymentService = result['payment-service'] as Record<
        string,
        unknown
      >;
      expect(paymentService.STRIPE_KEY).toBe('sk_...');
    });

    it('should handle entirely user-defined services', () => {
      const framework: SecretsFile = {
        secrets: {},
      };

      const user: SecretsFile = {
        secrets: {},
        'custom-service': {
          secrets: [],
          CUSTOM_KEY: 'custom-value',
        },
      };

      const result = mergeSecrets(framework, user);

      const customService = result['custom-service'] as Record<string, unknown>;
      expect(customService.CUSTOM_KEY).toBe('custom-value');
    });
  });

  describe('Secrets array resolution', () => {
    it('should resolve references in secrets arrays to actual values', () => {
      const framework: SecretsFile = {
        secrets: {
          KEY1: 'value1',
          KEY2: 'value2',
          KEY3: 'value3',
        },
        'auth-service': {
          secrets: ['KEY1', 'KEY2'],
        },
      };

      const user: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: ['KEY3'],
        },
      };

      const result = mergeSecrets(framework, user);

      const authService = result['auth-service'] as Record<string, unknown>;
      // Secrets array should be removed, and resolved values should be added as properties
      expect(authService.secrets).toBeUndefined();
      // All secrets from both framework and user should be resolved (arrays are merged)
      expect(authService.KEY1).toBe('value1');
      expect(authService.KEY2).toBe('value2');
      expect(authService.KEY3).toBe('value3');
    });

    it('should handle empty secrets array (preserves framework secrets)', () => {
      const framework: SecretsFile = {
        secrets: {
          KEY1: 'value1',
        },
        'auth-service': {
          secrets: ['KEY1'],
        },
      };

      const user: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
        },
      };

      const result = mergeSecrets(framework, user);

      const authService = result['auth-service'] as Record<string, unknown>;
      // Secrets array is removed after resolution
      expect(authService.secrets).toBeUndefined();
      // Framework secrets are preserved even when user has empty array
      expect(authService.KEY1).toBe('value1');
    });
  });

  describe('Primitive value handling', () => {
    it('should override with different string value', () => {
      const framework: SecretsFile = {
        secrets: {
          SOME_KEY: 'framework-value',
        },
      };

      const user: SecretsFile = {
        secrets: {
          SOME_KEY: 'user-value',
        },
      };

      const result = mergeSecrets(framework, user);

      expect(result.secrets.SOME_KEY).toBe('user-value');
    });

    it('should override with empty string', () => {
      const framework: SecretsFile = {
        secrets: {
          SOME_KEY: 'value',
        },
      };

      const user: SecretsFile = {
        secrets: {
          SOME_KEY: '',
        },
      };

      const result = mergeSecrets(framework, user);

      expect(result.secrets.SOME_KEY).toBe('');
    });

    it('should handle numbers', () => {
      const framework: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
          PORT: '3001',
        },
      };

      const user: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
          TIMEOUT: 5000,
        },
      };

      const result = mergeSecrets(framework, user);

      const authService = result['auth-service'] as Record<string, unknown>;
      expect(authService.PORT).toBe('3001');
      expect(authService.TIMEOUT).toBe(5000);
    });
  });

  describe('API_KEY resolution', () => {
    it('should call resolveApiKeyReferences after merging', () => {
      const framework: SecretsFile = {
        secrets: {},
      };

      const user: SecretsFile = {
        secrets: {},
      };

      mergeSecrets(framework, user);

      expect(
        resolveApiKeyReferencesModule.resolveApiKeyReferences,
      ).toHaveBeenCalled();
    });

    it('should pass merged result to resolveApiKeyReferences', () => {
      const framework: SecretsFile = {
        secrets: {
          AUTH_SERVICE_API_KEY: 'auth-key',
        },
        'auth-service': {
          secrets: [],
          API_KEY: 'AUTH_SERVICE_API_KEY',
        },
      };

      const user: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
          PORT: '3001',
        },
      };

      mergeSecrets(framework, user);

      // Due to recursive merging, resolveApiKeyReferences is called multiple times
      // Get the last call which has the final merged result
      const calls = rs.mocked(
        resolveApiKeyReferencesModule.resolveApiKeyReferences,
      ).mock.calls;
      const lastCall = calls[calls.length - 1];
      const callArg = lastCall[0];

      expect(callArg.secrets.AUTH_SERVICE_API_KEY).toBe('auth-key');

      const authService = callArg['auth-service'] as Record<string, unknown>;
      expect(authService.API_KEY).toBe('AUTH_SERVICE_API_KEY');
      expect(authService.PORT).toBe('3001');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty framework', () => {
      const framework: SecretsFile = {
        secrets: {},
      };

      const user: SecretsFile = {
        secrets: {
          USER_KEY: 'user-value',
        },
      };

      const result = mergeSecrets(framework, user);

      expect(result.secrets.USER_KEY).toBe('user-value');
    });

    it('should handle empty user', () => {
      const framework: SecretsFile = {
        secrets: {
          FRAMEWORK_KEY: 'framework-value',
        },
      };

      const user: SecretsFile = {
        secrets: {},
      };

      const result = mergeSecrets(framework, user);

      expect(result.secrets.FRAMEWORK_KEY).toBe('framework-value');
    });

    it('should handle both empty', () => {
      const framework: SecretsFile = {
        secrets: {},
      };

      const user: SecretsFile = {
        secrets: {},
      };

      const result = mergeSecrets(framework, user);

      expect(result.secrets).toEqual({});
    });

    it('should handle merging when framework value is not an object', () => {
      const framework: SecretsFile = {
        secrets: {},
        'some-service': 'string-value',
      };

      const user: SecretsFile = {
        secrets: {},
        'some-service': {
          KEY: 'value',
        },
      };

      const result = mergeSecrets(framework, user);

      const someService = result['some-service'] as Record<string, unknown>;
      expect(someService.KEY).toBe('value');
    });

    it('should handle merging when framework value is an array', () => {
      const framework: SecretsFile = {
        secrets: {},
        'some-service': ['item1', 'item2'],
      };

      const user: SecretsFile = {
        secrets: {},
        'some-service': {
          KEY: 'value',
        },
      };

      const result = mergeSecrets(framework, user);

      const someService = result['some-service'] as Record<string, unknown>;
      expect(someService.KEY).toBe('value');
    });
  });

  describe('Complex scenarios', () => {
    it('should handle the documented example scenario', () => {
      const framework: SecretsFile = {
        secrets: {
          AUTH_SECRET: 'xyz123',
        },
        'auth-service': {
          secrets: [],
          PORT: '3001',
          DATABASE_URL: 'postgresql://...',
        },
      };

      const user: SecretsFile = {
        secrets: {
          STRIPE_API_KEY: 'sk_...',
        },
        'auth-service': {
          secrets: [],
          ALLOWED_ORIGINS: 'http://localhost:3000',
        },
        'payment-service': {
          secrets: [],
          STRIPE_KEY: 'sk_live_...',
        },
      };

      const result = mergeSecrets(framework, user);

      // Check secrets merged
      expect(result.secrets.AUTH_SECRET).toBe('xyz123');
      expect(result.secrets.STRIPE_API_KEY).toBe('sk_...');

      // Check auth-service merged
      const authService = result['auth-service'] as Record<string, unknown>;
      expect(authService.PORT).toBe('3001');
      expect(authService.DATABASE_URL).toBe('postgresql://...');
      expect(authService.ALLOWED_ORIGINS).toBe('http://localhost:3000');

      // Check payment-service added
      const paymentService = result['payment-service'] as Record<
        string,
        unknown
      >;
      expect(paymentService.STRIPE_KEY).toBe('sk_live_...');
    });
  });
});
