import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { generateServiceApiKeys } from './generate-service-api-keys';
import { createMockFrameworkConfig } from '../../test-fixtures/framework-config';
import * as generateHexSecretModule from './generate-hex-secret';

// Mock generateHexSecret to return predictable values
rs.mock('./generate-hex-secret', () => ({
  generateHexSecret: rs.fn(() => 'mocked-hex-secret-64-chars-long'),
}));

describe('generateServiceApiKeys', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });
  describe('Backend services', () => {
    it('should generate API keys for NestJS services', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const result = generateServiceApiKeys(config);

      expect(result).toHaveProperty('AUTH_SERVICE_API_KEY');
      expect(result.AUTH_SERVICE_API_KEY).toBe(
        'mocked-hex-secret-64-chars-long',
      );
    });

    it('should generate API keys for multiple backend services', () => {
      const config = createMockFrameworkConfig({
        services: [
          { name: 'auth-service', type: 'nestjs', port: 3001 },
          { name: 'user-service', type: 'nestjs', port: 3002 },
          { name: 'api', type: 'nestjs', port: 3003 },
        ],
      });

      const result = generateServiceApiKeys(config);

      expect(result).toHaveProperty('AUTH_SERVICE_API_KEY');
      expect(result).toHaveProperty('USER_SERVICE_API_KEY');
      expect(result).toHaveProperty('API_API_KEY');
    });

    it('should convert service names to SCREAMING_SNAKE_CASE', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'my-complex-service', type: 'nestjs', port: 3001 }],
      });

      const result = generateServiceApiKeys(config);

      expect(result).toHaveProperty('MY_COMPLEX_SERVICE_API_KEY');
    });

    it('should call generateHexSecret with 32 bytes', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      generateServiceApiKeys(config);

      expect(generateHexSecretModule.generateHexSecret).toHaveBeenCalledWith(
        32,
      );
    });
  });

  describe('Frontend services', () => {
    it('should not generate API keys for Next.js services', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'frontend', type: 'nextjs', port: 3000 }],
      });

      const result = generateServiceApiKeys(config);

      expect(result).not.toHaveProperty('FRONTEND_API_KEY');
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should not generate API keys for SPA services', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'admin-ui', type: 'spa', port: 3000 }],
      });

      const result = generateServiceApiKeys(config);

      expect(result).not.toHaveProperty('ADMIN_UI_API_KEY');
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('Mixed frontend and backend services', () => {
    it('should only generate keys for backend services', () => {
      const config = createMockFrameworkConfig({
        services: [
          { name: 'frontend', type: 'nextjs', port: 3000 },
          { name: 'auth-service', type: 'nestjs', port: 3001 },
          { name: 'admin-ui', type: 'spa', port: 3002 },
          { name: 'user-service', type: 'nestjs', port: 3003 },
        ],
      });

      const result = generateServiceApiKeys(config);

      expect(result).toHaveProperty('AUTH_SERVICE_API_KEY');
      expect(result).toHaveProperty('USER_SERVICE_API_KEY');
      expect(result).not.toHaveProperty('FRONTEND_API_KEY');
      expect(result).not.toHaveProperty('ADMIN_UI_API_KEY');
      expect(Object.keys(result)).toHaveLength(2);
    });
  });

  describe('Preserving existing secrets', () => {
    it('should preserve existing API keys', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const existingSecrets = {
        AUTH_SERVICE_API_KEY: 'existing-key-123',
      };

      const result = generateServiceApiKeys(config, existingSecrets);

      expect(result.AUTH_SERVICE_API_KEY).toBe('existing-key-123');
      expect(generateHexSecretModule.generateHexSecret).not.toHaveBeenCalled();
    });

    it('should generate missing keys while preserving existing ones', () => {
      const config = createMockFrameworkConfig({
        services: [
          { name: 'auth-service', type: 'nestjs', port: 3001 },
          { name: 'user-service', type: 'nestjs', port: 3002 },
        ],
      });

      const existingSecrets = {
        AUTH_SERVICE_API_KEY: 'existing-auth-key',
      };

      const result = generateServiceApiKeys(config, existingSecrets);

      expect(result.AUTH_SERVICE_API_KEY).toBe('existing-auth-key');
      expect(result.USER_SERVICE_API_KEY).toBe(
        'mocked-hex-secret-64-chars-long',
      );
    });

    it('should preserve other existing secrets', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const existingSecrets = {
        AUTH_SECRET: 'my-auth-secret',
        DATABASE_URL: 'postgresql://localhost/db',
      };

      const result = generateServiceApiKeys(config, existingSecrets);

      expect(result.AUTH_SECRET).toBe('my-auth-secret');
      expect(result.DATABASE_URL).toBe('postgresql://localhost/db');
      expect(result).toHaveProperty('AUTH_SERVICE_API_KEY');
    });

    it('should not mutate existingSecrets object', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const existingSecrets = {
        AUTH_SECRET: 'my-secret',
      };

      const result = generateServiceApiKeys(config, existingSecrets);

      expect(existingSecrets).not.toHaveProperty('AUTH_SERVICE_API_KEY');
      expect(result).toHaveProperty('AUTH_SERVICE_API_KEY');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty services array', () => {
      const config = createMockFrameworkConfig({
        services: [],
      });

      const result = generateServiceApiKeys(config);

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should handle config with no existing secrets', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const result = generateServiceApiKeys(config);

      expect(result).toHaveProperty('AUTH_SERVICE_API_KEY');
    });

    it('should handle single-word service names', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'api', type: 'nestjs', port: 3001 }],
      });

      const result = generateServiceApiKeys(config);

      expect(result).toHaveProperty('API_API_KEY');
    });

    it('should handle service names with numbers', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'api-v2', type: 'nestjs', port: 3001 }],
      });

      const result = generateServiceApiKeys(config);

      expect(result).toHaveProperty('API_V2_API_KEY');
    });
  });
});
