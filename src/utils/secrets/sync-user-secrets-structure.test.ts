import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { syncUserSecretsStructure } from './sync-user-secrets-structure';
import { createMockFrameworkConfig } from '../../test-fixtures/framework-config';
import type { SecretsFile } from './types';
import * as createServiceSectionModule from './create-service-section';

// Mock dependencies
rs.mock('./create-service-section', { mock: true });

describe('syncUserSecretsStructure', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    rs.mocked(createServiceSectionModule.createServiceSection).mockReturnValue({
      secrets: ['NODE_ENV'],
    });
  });

  describe('Framework secrets must NEVER be added to user secrets', () => {
    it('should NEVER add JWT keys to user secrets', () => {
      const existing: SecretsFile = {
        secrets: {},
      };

      const config = createMockFrameworkConfig({
        framework: { template: 'auth' },
      });

      const result = syncUserSecretsStructure(existing, config);

      // Framework secrets should NEVER be added to user secrets
      if (result) {
        expect(result.secrets.JWT_PRIVATE_KEY_CURRENT).toBeUndefined();
        expect(result.secrets.JWT_PUBLIC_KEY_CURRENT).toBeUndefined();
        expect(result.secrets.JWT_KEY_ID_CURRENT).toBeUndefined();
      }
    });

    it('should NEVER add BCRYPT_ROUNDS to user secrets', () => {
      const existing: SecretsFile = {
        secrets: {},
      };

      const config = createMockFrameworkConfig();

      const result = syncUserSecretsStructure(existing, config);

      // Framework secrets should NEVER be added to user secrets
      if (result) {
        expect(result.secrets.BCRYPT_ROUNDS).toBeUndefined();
      }
    });

    it('should NEVER add KONG_TRUST_TOKEN to user secrets', () => {
      const existing: SecretsFile = {
        secrets: {},
      };

      const config = createMockFrameworkConfig();

      const result = syncUserSecretsStructure(existing, config);

      // Framework secrets should NEVER be added to user secrets
      if (result) {
        expect(result.secrets.KONG_TRUST_TOKEN).toBeUndefined();
      }
    });

    it('should NEVER add service API keys to user secrets', () => {
      const existing: SecretsFile = {
        secrets: {},
      };

      const config = createMockFrameworkConfig({
        services: [
          { name: 'auth-service', type: 'nestjs', port: 3001 },
          { name: 'bff-service', type: 'nestjs', port: 3003 },
        ],
      });

      const result = syncUserSecretsStructure(existing, config);

      // Framework secrets should NEVER be added to user secrets
      if (result) {
        expect(result.secrets.AUTH_SERVICE_API_KEY).toBeUndefined();
        expect(result.secrets.BFF_SERVICE_API_KEY).toBeUndefined();
      }
    });

    it('should preserve existing framework secrets without adding new ones', () => {
      // This test ensures that if user manually added framework secrets, we don't remove them
      // but we also don't add new ones
      const existing: SecretsFile = {
        secrets: {
          ACCESS_TOKEN_TTL: '900',
          REFRESH_TOKEN_TTL: '604800',
          CONFIRMATION_TOKEN_TTL: '86400',
          APP_URL: 'http://localhost:3000',
          DOMAIN: '',
          // User manually added these (shouldn't be here, but we preserve them)
          JWT_PRIVATE_KEY_CURRENT: 'existing-private',
          BCRYPT_ROUNDS: '12',
        },
      };

      const config = createMockFrameworkConfig();

      const result = syncUserSecretsStructure(existing, config);

      // Should return null (no changes) since TTLs, APP_URL already exist
      expect(result).toBeNull();
    });
  });

  describe('TTL values syncing', () => {
    it('should add missing TTL values', () => {
      const existing: SecretsFile = {
        secrets: {},
      };

      const config = createMockFrameworkConfig();

      const result = syncUserSecretsStructure(existing, config);

      expect(result).not.toBeNull();
      expect(result!.secrets.ACCESS_TOKEN_TTL).toBe('900');
      expect(result!.secrets.REFRESH_TOKEN_TTL).toBe('604800');
      expect(result!.secrets.CONFIRMATION_TOKEN_TTL).toBe('86400');
    });

    it('should not overwrite existing TTL values', () => {
      const existing: SecretsFile = {
        secrets: {
          ACCESS_TOKEN_TTL: '1800',
          REFRESH_TOKEN_TTL: '1209600',
          CONFIRMATION_TOKEN_TTL: '172800000',
          APP_URL: 'http://localhost:3000',
          DOMAIN: '',
        },
      };

      const config = createMockFrameworkConfig();

      const result = syncUserSecretsStructure(existing, config);

      // Should return null (no changes)
      expect(result).toBeNull();
    });

    it('should add only missing TTL values', () => {
      const existing: SecretsFile = {
        secrets: {
          ACCESS_TOKEN_TTL: '1800',
          // Missing REFRESH_TOKEN_TTL and CONFIRMATION_TOKEN_TTL
        },
      };

      const config = createMockFrameworkConfig();

      const result = syncUserSecretsStructure(existing, config);

      expect(result).not.toBeNull();
      expect(result!.secrets.ACCESS_TOKEN_TTL).toBe('1800'); // Preserved
      expect(result!.secrets.REFRESH_TOKEN_TTL).toBe('604800'); // Added
      expect(result!.secrets.CONFIRMATION_TOKEN_TTL).toBe('86400'); // Added
    });
  });

  describe('Deprecated properties cleanup', () => {
    it('should remove ALLOWED_ORIGINS from existing service sections', () => {
      const existing: SecretsFile = {
        secrets: {
          ACCESS_TOKEN_TTL: '900',
          REFRESH_TOKEN_TTL: '604800',
          CONFIRMATION_TOKEN_TTL: '86400',
        },
        'auth-service': {
          secrets: ['NODE_ENV'],
          ALLOWED_ORIGINS: 'http://localhost:3000',
        },
        'bff-service': {
          secrets: [],
          ALLOWED_ORIGINS: 'http://localhost:3000',
        },
      };

      const config = createMockFrameworkConfig({
        services: [
          { name: 'auth-service', type: 'nestjs', port: 3001 },
          { name: 'bff-service', type: 'nestjs', port: 3002 },
        ],
      });

      const result = syncUserSecretsStructure(existing, config);

      expect(result).not.toBeNull();
      if (result) {
        // ALLOWED_ORIGINS should be removed from both services
        expect(result['auth-service']).not.toHaveProperty('ALLOWED_ORIGINS');
        expect(result['bff-service']).not.toHaveProperty('ALLOWED_ORIGINS');
        // Other properties should be preserved
        // auth-service had ['NODE_ENV'], bff-service had [] which gets merged with mock's ['NODE_ENV']
        expect(
          (result['auth-service'] as Record<string, unknown>).secrets,
        ).toEqual(['NODE_ENV']);
        expect(
          (result['bff-service'] as Record<string, unknown>).secrets,
        ).toEqual(['NODE_ENV']);
      }
    });
  });

  describe('Service sections syncing', () => {
    it('should add missing service sections', () => {
      const existing: SecretsFile = {
        secrets: {},
      };

      const config = createMockFrameworkConfig({
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const result = syncUserSecretsStructure(existing, config);

      expect(result).not.toBeNull();
      expect(result!['auth-service']).toBeDefined();
      expect(
        createServiceSectionModule.createServiceSection,
      ).toHaveBeenCalledWith(config.services[0]);
    });

    it('should remove orphaned services not in config', () => {
      const existing: SecretsFile = {
        secrets: {},
        'old-service': {
          secrets: ['NODE_ENV'],
        },
      };

      const config = createMockFrameworkConfig({
        services: [{ name: 'new-service', type: 'nestjs', port: 3001 }],
      });

      const result = syncUserSecretsStructure(existing, config);

      expect(result).not.toBeNull();
      expect(result!['old-service']).toBeUndefined();
      expect(result!['new-service']).toBeDefined();
    });

    it('should merge existing service secrets array with new structure (preserving user additions)', () => {
      const existing: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: ['OLD_SECRET'],
        },
      };

      const config = createMockFrameworkConfig({
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      rs.mocked(
        createServiceSectionModule.createServiceSection,
      ).mockReturnValue({
        secrets: ['NODE_ENV', 'NEW_SECRET'],
      });

      const result = syncUserSecretsStructure(existing, config);

      expect(result).not.toBeNull();
      const authService = result!['auth-service'] as { secrets: string[] };
      // Should preserve OLD_SECRET and add NODE_ENV, NEW_SECRET
      expect(authService.secrets).toEqual([
        'OLD_SECRET',
        'NODE_ENV',
        'NEW_SECRET',
      ]);
    });

    it('should preserve existing service section properties', () => {
      const existing: SecretsFile = {
        secrets: {},
        'auth-service': {
          secrets: ['NODE_ENV'],
          API_KEY: 'AUTH_SERVICE_API_KEY',
          CUSTOM_PROPERTY: 'custom-value',
        },
      };

      const config = createMockFrameworkConfig({
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const result = syncUserSecretsStructure(existing, config);

      if (result) {
        expect(result['auth-service']).toHaveProperty('API_KEY');
        expect(
          (result['auth-service'] as Record<string, unknown>).CUSTOM_PROPERTY,
        ).toBe('custom-value');
      }
    });
  });

  // Partner API keys section removed - now configured in kong.user.yml

  describe('Return value', () => {
    it('should return null when no changes needed', () => {
      const existing: SecretsFile = {
        secrets: {
          ACCESS_TOKEN_TTL: '900',
          REFRESH_TOKEN_TTL: '604800',
          CONFIRMATION_TOKEN_TTL: '86400',
          APP_URL: 'http://localhost:3000',
          DOMAIN: '',
        },
      };

      const config = createMockFrameworkConfig();

      const result = syncUserSecretsStructure(existing, config);

      expect(result).toBeNull();
    });

    it('should return updated file when changes made', () => {
      const existing: SecretsFile = {
        secrets: {},
      };

      const config = createMockFrameworkConfig({
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const result = syncUserSecretsStructure(existing, config);

      expect(result).not.toBeNull();
      expect(result!['auth-service']).toBeDefined();
    });

    it('should not mutate the original existing secrets', () => {
      const existing: SecretsFile = {
        secrets: {},
      };

      const config = createMockFrameworkConfig({
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      syncUserSecretsStructure(existing, config);

      // Original should not have the new service
      expect(existing['auth-service']).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should remove orphaned services when config has no services', () => {
      const existing: SecretsFile = {
        secrets: {},
        'old-service': {
          secrets: ['NODE_ENV'],
        },
      };

      const config = createMockFrameworkConfig();

      const result = syncUserSecretsStructure(existing, config);

      // Should remove orphaned service and add TTLs
      expect(result).not.toBeNull();
      if (result) {
        expect(result['old-service']).toBeUndefined();
      }
    });

    it('should handle missing secrets object in existing file', () => {
      const existing: SecretsFile = { secrets: {} };

      const config = createMockFrameworkConfig();

      const result = syncUserSecretsStructure(existing, config);

      // Should create secrets object with TTLs
      expect(result).not.toBeNull();
      expect(result!.secrets).toBeDefined();
      expect(result!.secrets.ACCESS_TOKEN_TTL).toBe('900');
    });

    it('should handle service section that is not an object', () => {
      const existing = {
        secrets: {},
        'weird-service': 'string-value',
      } as SecretsFile;

      const config = createMockFrameworkConfig({
        services: [
          { name: 'weird-service', type: 'nestjs', port: 3001 },
          { name: 'new-service', type: 'nestjs', port: 3002 },
        ],
      });

      const result = syncUserSecretsStructure(existing, config);

      // Should not crash, and should add new-service (causing changes)
      expect(result).not.toBeNull();
      expect(result!['new-service']).toBeDefined();
    });
  });
});
