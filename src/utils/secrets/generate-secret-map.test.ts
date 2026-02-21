import { describe, it, expect } from '@rstest/core';
import { generateSecretMap } from './generate-secret-map';
import { createMockFrameworkConfig } from '../../test-fixtures/framework-config';
import type { SecretsFile } from './types';

describe('generateSecretMap', () => {
  const emptySecrets: SecretsFile = { secrets: {} };

  describe('Standard use cases', () => {
    it('should extract secrets array for each service', () => {
      const config = createMockFrameworkConfig({
        services: [
          { name: 'auth-service', type: 'nestjs', port: 3001 },
          { name: 'frontend', type: 'nextjs', port: 3000 },
        ],
      });

      const frameworkSecrets: SecretsFile = {
        secrets: { NODE_ENV: 'development' },
        'auth-service': {
          PORT: '3001',
          secrets: ['NODE_ENV', 'REDIS_HOST', 'KONG_TRUST_TOKEN'],
        },
        frontend: {
          PORT: '3000',
          secrets: ['KONG_INTERNAL_URL'],
        },
      };

      const userSecrets: SecretsFile = {
        secrets: {},
        frontend: {
          secrets: ['API_URL'],
        },
      };

      const result = generateSecretMap(frameworkSecrets, userSecrets, config);

      expect(result).toEqual({
        'auth-service': ['NODE_ENV', 'REDIS_HOST', 'KONG_TRUST_TOKEN'],
        frontend: ['KONG_INTERNAL_URL', 'API_URL'],
      });
    });

    it('should deduplicate keys present in both framework and user', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'frontend', type: 'nextjs', port: 3000 }],
      });

      const frameworkSecrets: SecretsFile = {
        secrets: {},
        frontend: { secrets: ['KONG_INTERNAL_URL'] },
      };

      const userSecrets: SecretsFile = {
        secrets: {},
        frontend: { secrets: ['KONG_INTERNAL_URL', 'API_URL'] },
      };

      const result = generateSecretMap(frameworkSecrets, userSecrets, config);

      expect(result['frontend']).toEqual(['KONG_INTERNAL_URL', 'API_URL']);
    });

    it('should include DATABASE_URL when present in service entry', () => {
      const config = createMockFrameworkConfig({
        services: [
          {
            name: 'auth-service',
            type: 'nestjs',
            port: 3001,
            hasDatabase: true,
          },
        ],
      });

      const frameworkSecrets: SecretsFile = {
        secrets: { NODE_ENV: 'development' },
        'auth-service': {
          PORT: '3001',
          secrets: ['NODE_ENV', 'REDIS_HOST'],
          DATABASE_URL: 'postgresql://user:pass@localhost:5432/auth',
        },
      };

      const result = generateSecretMap(frameworkSecrets, emptySecrets, config);

      expect(result['auth-service']).toEqual([
        'NODE_ENV',
        'REDIS_HOST',
        'DATABASE_URL',
      ]);
    });

    it('should skip worker services', () => {
      const config = createMockFrameworkConfig({
        services: [
          { name: 'auth-service', type: 'nestjs', port: 3001 },
          { name: 'auth-worker', type: 'worker', baseService: 'auth-service' },
        ],
      });

      const frameworkSecrets: SecretsFile = {
        secrets: { NODE_ENV: 'development' },
        'auth-service': {
          PORT: '3001',
          secrets: ['NODE_ENV'],
        },
      };

      const result = generateSecretMap(frameworkSecrets, emptySecrets, config);

      expect(result).toEqual({
        'auth-service': ['NODE_ENV'],
      });
      expect(result['auth-worker']).toBeUndefined();
    });
  });

  describe('Edge cases', () => {
    it('should return empty array when service has no entry in either secrets file', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'new-service', type: 'nestjs', port: 3001 }],
      });

      const result = generateSecretMap(emptySecrets, emptySecrets, config);

      expect(result['new-service']).toEqual([]);
    });

    it('should return empty array when service entry has no secrets array', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'frontend', type: 'nextjs', port: 3000 }],
      });

      const frameworkSecrets: SecretsFile = {
        secrets: {},
        frontend: { PORT: '3000' },
      };

      const result = generateSecretMap(frameworkSecrets, emptySecrets, config);

      expect(result['frontend']).toEqual([]);
    });

    it('should handle empty services array', () => {
      const config = createMockFrameworkConfig({ services: [] });

      const result = generateSecretMap(emptySecrets, emptySecrets, config);

      expect(result).toEqual({});
    });

    it('should handle SPA services with user secrets only', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'admin-ui', type: 'spa', port: 3002 }],
      });

      const frameworkSecrets: SecretsFile = {
        secrets: {},
        'admin-ui': { PORT: '3002', secrets: [] },
      };

      const userSecrets: SecretsFile = {
        secrets: {},
        'admin-ui': { secrets: ['API_URL'] },
      };

      const result = generateSecretMap(frameworkSecrets, userSecrets, config);

      expect(result['admin-ui']).toEqual(['API_URL']);
    });
  });
});
