import { describe, it, expect } from '@rstest/core';
import { addJwtKeysToAuthService } from './add-jwt-keys-to-auth-service';
import type { SecretsFile, ServiceSecrets } from './types';

describe('addJwtKeysToAuthService', () => {
  // User secrets that auth-service needs (TTLs + APP_URL for email links)
  const AUTH_USER_SECRETS = [
    'ACCESS_TOKEN_TTL',
    'REFRESH_TOKEN_TTL',
    'CONFIRMATION_TOKEN_TTL',
    'APP_URL',
  ];

  describe('When auth template is enabled', () => {
    it('should add TTL values to auth-service when missing', () => {
      const file: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: ['NODE_ENV', 'REDIS_HOST'],
        },
      };

      const result = addJwtKeysToAuthService(file, true);

      expect(result).toBe(true);
      expect((file['auth-service'] as ServiceSecrets).secrets).toEqual([
        'NODE_ENV',
        'REDIS_HOST',
        'ACCESS_TOKEN_TTL',
        'REFRESH_TOKEN_TTL',
        'CONFIRMATION_TOKEN_TTL',
        'APP_URL',
      ]);
    });

    it('should not add secrets if already present', () => {
      const file: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [
            'NODE_ENV',
            'ACCESS_TOKEN_TTL',
            'REFRESH_TOKEN_TTL',
            'CONFIRMATION_TOKEN_TTL',
            'APP_URL',
          ],
        },
      };

      const result = addJwtKeysToAuthService(file, true);

      expect(result).toBe(false);
      expect((file['auth-service'] as ServiceSecrets).secrets).toEqual([
        'NODE_ENV',
        'ACCESS_TOKEN_TTL',
        'REFRESH_TOKEN_TTL',
        'CONFIRMATION_TOKEN_TTL',
        'APP_URL',
      ]);
    });

    it('should add only missing secrets', () => {
      const file: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: ['NODE_ENV', 'ACCESS_TOKEN_TTL'],
        },
      };

      const result = addJwtKeysToAuthService(file, true);

      expect(result).toBe(true);
      expect((file['auth-service'] as ServiceSecrets).secrets).toEqual([
        'NODE_ENV',
        'ACCESS_TOKEN_TTL',
        'REFRESH_TOKEN_TTL',
        'CONFIRMATION_TOKEN_TTL',
        'APP_URL',
      ]);
    });

    it('should preserve existing secrets order and add at the end', () => {
      const file: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: ['CUSTOM_SECRET', 'NODE_ENV', 'REDIS_HOST'],
        },
      };

      const result = addJwtKeysToAuthService(file, true);

      expect(result).toBe(true);
      expect((file['auth-service'] as ServiceSecrets).secrets).toEqual([
        'CUSTOM_SECRET',
        'NODE_ENV',
        'REDIS_HOST',
        'ACCESS_TOKEN_TTL',
        'REFRESH_TOKEN_TTL',
        'CONFIRMATION_TOKEN_TTL',
        'APP_URL',
      ]);
    });

    it('should return false when auth-service does not exist', () => {
      const file: SecretsFile = {
        secrets: {},
        'other-service': {
          secrets: ['NODE_ENV'],
        },
      };

      const result = addJwtKeysToAuthService(file, true);

      expect(result).toBe(false);
      expect(file['auth-service']).toBeUndefined();
    });

    it('should handle auth-service with empty secrets array', () => {
      const file: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: [],
        },
      };

      const result = addJwtKeysToAuthService(file, true);

      expect(result).toBe(true);
      expect((file['auth-service'] as ServiceSecrets).secrets).toEqual(
        AUTH_USER_SECRETS,
      );
    });
  });

  describe('When auth template is disabled', () => {
    it('should not add TTL values when useAuthTemplate is false', () => {
      const file: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: ['NODE_ENV', 'REDIS_HOST'],
        },
      };

      const result = addJwtKeysToAuthService(file, false);

      expect(result).toBe(false);
      expect((file['auth-service'] as ServiceSecrets).secrets).toEqual([
        'NODE_ENV',
        'REDIS_HOST',
      ]);
    });

    it('should not add TTL values when useAuthTemplate is undefined', () => {
      const file: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: ['NODE_ENV', 'REDIS_HOST'],
        },
      };

      const result = addJwtKeysToAuthService(file, undefined);

      expect(result).toBe(false);
      expect((file['auth-service'] as ServiceSecrets).secrets).toEqual([
        'NODE_ENV',
        'REDIS_HOST',
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should mutate the file in place', () => {
      const file: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: ['NODE_ENV'],
        },
      };

      const originalAuthService = file['auth-service'];
      addJwtKeysToAuthService(file, true);

      // Should be the same object reference (mutated in place)
      expect(file['auth-service']).toBe(originalAuthService);
    });

    it('should handle file with multiple services', () => {
      const file: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: ['NODE_ENV'],
        },
        'other-service': {
          secrets: ['NODE_ENV', 'DATABASE_URL'],
        },
      };

      const result = addJwtKeysToAuthService(file, true);

      expect(result).toBe(true);
      expect((file['auth-service'] as ServiceSecrets).secrets).toContain(
        'ACCESS_TOKEN_TTL',
      );
      expect((file['other-service'] as ServiceSecrets).secrets).not.toContain(
        'ACCESS_TOKEN_TTL',
      );
    });

    it('should handle auth-service with additional properties', () => {
      const file: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: ['NODE_ENV'],
          ALLOWED_ORIGINS: 'http://localhost:3000',
        },
      };

      const result = addJwtKeysToAuthService(file, true);

      expect(result).toBe(true);
      expect(file['auth-service']).toHaveProperty('ALLOWED_ORIGINS');
      expect((file['auth-service'] as ServiceSecrets).secrets).toContain(
        'ACCESS_TOKEN_TTL',
      );
    });
  });
});
