import { describe, it, expect } from '@rstest/core';
import { generateServiceUrls } from './generate-service-urls';
import { createMockFrameworkConfig } from '../../test-fixtures/framework-config';

describe('generateServiceUrls', () => {
  describe('Backend services', () => {
    it('should generate URLs for NestJS services', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const result = generateServiceUrls(config);

      expect(result).toHaveProperty('AUTH_SERVICE_URL');
      expect(result.AUTH_SERVICE_URL).toBe('http://localhost:3001');
    });

    it('should generate URLs for multiple backend services', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [
          { name: 'auth-service', type: 'nestjs', port: 3001 },
          { name: 'user-service', type: 'nestjs', port: 3002 },
          { name: 'api', type: 'nestjs', port: 3003 },
        ],
      });

      const result = generateServiceUrls(config);

      expect(result).toHaveProperty('AUTH_SERVICE_URL');
      expect(result.AUTH_SERVICE_URL).toBe('http://localhost:3001');
      expect(result).toHaveProperty('USER_SERVICE_URL');
      expect(result.USER_SERVICE_URL).toBe('http://localhost:3002');
      expect(result).toHaveProperty('API_URL');
      expect(result.API_URL).toBe('http://localhost:3003');
    });

    it('should convert service names to SCREAMING_SNAKE_CASE', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [{ name: 'my-complex-service', type: 'nestjs', port: 3001 }],
      });

      const result = generateServiceUrls(config);

      expect(result).toHaveProperty('MY_COMPLEX_SERVICE_URL');
    });
  });

  describe('Frontend services', () => {
    it('should not generate URLs for Next.js services', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [{ name: 'frontend', type: 'nextjs', port: 3000 }],
      });

      const result = generateServiceUrls(config);

      expect(result).not.toHaveProperty('FRONTEND_URL');
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should not generate URLs for SPA services', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [{ name: 'admin-ui', type: 'spa', port: 3000 }],
      });

      const result = generateServiceUrls(config);

      expect(result).not.toHaveProperty('ADMIN_UI_URL');
      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('Mixed frontend and backend services', () => {
    it('should only generate URLs for backend services', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [
          { name: 'frontend', type: 'nextjs', port: 3000 },
          { name: 'auth-service', type: 'nestjs', port: 3001 },
          { name: 'admin-ui', type: 'spa', port: 3002 },
          { name: 'user-service', type: 'nestjs', port: 3003 },
        ],
      });

      const result = generateServiceUrls(config);

      expect(result).toHaveProperty('AUTH_SERVICE_URL');
      expect(result.AUTH_SERVICE_URL).toBe('http://localhost:3001');
      expect(result).toHaveProperty('USER_SERVICE_URL');
      expect(result.USER_SERVICE_URL).toBe('http://localhost:3003');
      expect(result).not.toHaveProperty('FRONTEND_URL');
      expect(result).not.toHaveProperty('ADMIN_UI_URL');
      expect(Object.keys(result)).toHaveLength(2);
    });
  });

  describe('Preserving existing secrets', () => {
    it('should preserve existing URLs', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const existingSecrets = {
        AUTH_SERVICE_URL: 'http://existing-host:9999',
      };

      const result = generateServiceUrls(config, existingSecrets);

      expect(result.AUTH_SERVICE_URL).toBe('http://existing-host:9999');
    });

    it('should generate missing URLs while preserving existing ones', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [
          { name: 'auth-service', type: 'nestjs', port: 3001 },
          { name: 'user-service', type: 'nestjs', port: 3002 },
        ],
      });

      const existingSecrets = {
        AUTH_SERVICE_URL: 'http://custom-auth:8080',
      };

      const result = generateServiceUrls(config, existingSecrets);

      expect(result.AUTH_SERVICE_URL).toBe('http://custom-auth:8080');
      expect(result.USER_SERVICE_URL).toBe('http://localhost:3002');
    });

    it('should preserve other existing secrets', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const existingSecrets = {
        API_KEY: 'my-api-key',
        DATABASE_URL: 'postgresql://localhost/db',
      };

      const result = generateServiceUrls(config, existingSecrets);

      expect(result.API_KEY).toBe('my-api-key');
      expect(result.DATABASE_URL).toBe('postgresql://localhost/db');
      expect(result).toHaveProperty('AUTH_SERVICE_URL');
    });

    it('should not mutate existingSecrets object', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const existingSecrets = {
        API_KEY: 'my-key',
      };

      const result = generateServiceUrls(config, existingSecrets);

      expect(existingSecrets).not.toHaveProperty('AUTH_SERVICE_URL');
      expect(result).toHaveProperty('AUTH_SERVICE_URL');
    });
  });

  describe('Environment parameter', () => {
    it('should generate localhost URLs for local environment (default)', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const result = generateServiceUrls(config, {}, 'local');

      expect(result.AUTH_SERVICE_URL).toBe('http://localhost:3001');
    });

    it('should generate localhost URLs when environment is not specified', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const result = generateServiceUrls(config);

      expect(result.AUTH_SERVICE_URL).toBe('http://localhost:3001');
    });

    it('should generate VPC DNS URLs for cloud environment', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const result = generateServiceUrls(config, {}, 'cloud');

      expect(result.AUTH_SERVICE_URL).toBe('http://auth-service:3001');
    });

    it('should generate VPC DNS URLs for multiple services in cloud', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [
          { name: 'auth-service', type: 'nestjs', port: 3001 },
          { name: 'bff-service', type: 'nestjs', port: 3003 },
          { name: 'offers-service', type: 'nestjs', port: 3002 },
        ],
      });

      const result = generateServiceUrls(config, {}, 'cloud');

      expect(result.AUTH_SERVICE_URL).toBe('http://auth-service:3001');
      expect(result.BFF_SERVICE_URL).toBe('http://bff-service:3003');
      expect(result.OFFERS_SERVICE_URL).toBe('http://offers-service:3002');
    });

    it('should use service name as-is for cloud URLs (not localhost)', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [{ name: 'my-complex-service', type: 'nestjs', port: 3001 }],
      });

      const result = generateServiceUrls(config, {}, 'cloud');

      expect(result.MY_COMPLEX_SERVICE_URL).toBe(
        'http://my-complex-service:3001',
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty services array', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [],
      });

      const result = generateServiceUrls(config);

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should handle config with no existing secrets', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const result = generateServiceUrls(config);

      expect(result).toHaveProperty('AUTH_SERVICE_URL');
    });

    it('should handle single-word service names', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [{ name: 'api', type: 'nestjs', port: 3001 }],
      });

      const result = generateServiceUrls(config);

      expect(result).toHaveProperty('API_URL');
      expect(result.API_URL).toBe('http://localhost:3001');
    });

    it('should handle service names with numbers', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [{ name: 'api-v2', type: 'nestjs', port: 3001 }],
      });

      const result = generateServiceUrls(config);

      expect(result).toHaveProperty('API_V2_URL');
      expect(result.API_V2_URL).toBe('http://localhost:3001');
    });

    it('should handle different port numbers', () => {
      const config = createMockFrameworkConfig({
        project: { name: 'test-project', version: '1.0.0' },
        services: [
          { name: 'service-a', type: 'nestjs', port: 8080 },
          { name: 'service-b', type: 'nestjs', port: 9000 },
        ],
      });

      const result = generateServiceUrls(config);

      expect(result.SERVICE_A_URL).toBe('http://localhost:8080');
      expect(result.SERVICE_B_URL).toBe('http://localhost:9000');
    });
  });
});
