import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { generateUserSecretsFile } from './generate-user-secrets-file';
import { createMockFrameworkConfig } from '../../test-fixtures/framework-config';
import * as generateRSAKeyPairModule from './generate-rsa-keypair';
import * as autoDetectAllowedOriginsModule from './auto-detect-allowed-origins';
import * as generateServiceApiKeysModule from './generate-service-api-keys';
import * as generateServiceUrlsModule from './generate-service-urls';
import * as createServiceSectionModule from './create-service-section';
import * as addJwtKeysToAuthServiceModule from './add-jwt-keys-to-auth-service';

// Mock dependencies
rs.mock('./generate-rsa-keypair', { mock: true });
rs.mock('./auto-detect-allowed-origins', { mock: true });
rs.mock('./generate-service-api-keys', { mock: true });
rs.mock('./generate-service-urls', { mock: true });
rs.mock('./create-service-section', { mock: true });
rs.mock('./add-jwt-keys-to-auth-service', { mock: true });

describe('generateUserSecretsFile', () => {
  const mockRSAKeys = {
    privateKey:
      '-----BEGIN PRIVATE KEY-----\nmock-private-key\n-----END PRIVATE KEY-----\n',
    publicKey:
      '-----BEGIN PUBLIC KEY-----\nmock-public-key\n-----END PUBLIC KEY-----\n',
    keyId: '2025-01-15-key-1',
  };

  beforeEach(() => {
    rs.clearAllMocks();
    rs.mocked(generateRSAKeyPairModule.generateRSAKeyPair).mockReturnValue(
      mockRSAKeys,
    );
    rs.mocked(
      autoDetectAllowedOriginsModule.autoDetectAllowedOrigins,
    ).mockReturnValue('http://localhost:3000');
    rs.mocked(
      generateServiceApiKeysModule.generateServiceApiKeys,
    ).mockImplementation((_, secrets) => secrets ?? {});
    rs.mocked(generateServiceUrlsModule.generateServiceUrls).mockImplementation(
      (_, secrets) => secrets ?? {},
    );
    rs.mocked(createServiceSectionModule.createServiceSection).mockReturnValue({
      secrets: [],
    });
    rs.mocked(
      addJwtKeysToAuthServiceModule.addJwtKeysToAuthService,
    ).mockReturnValue(false);
  });

  describe('Basic structure', () => {
    it('should generate file with metadata fields', () => {
      const config = createMockFrameworkConfig();

      const result = generateUserSecretsFile(config);

      expect(result.$comment).toContain('YOUR CUSTOM SECRETS');
      expect(result.$instructions).toBeDefined();
      expect(result.$important).toBeDefined();
      expect(result.secrets).toBeDefined();
    });

    it('should include all base secrets with correct defaults', () => {
      const config = createMockFrameworkConfig();

      const result = generateUserSecretsFile(config);

      expect(result.secrets.DOMAIN).toBe('');
      expect(result.secrets.APP_URL).toBe('http://localhost:3000');
      expect(result.secrets.KONG_SERVICE_HOST).toBe(
        'http://host.docker.internal',
      );
      expect(result.secrets.API_URL).toBe('http://localhost:8000');
      expect(result.secrets.ACCESS_TOKEN_TTL).toBe('900');
      expect(result.secrets.REFRESH_TOKEN_TTL).toBe('604800');
      expect(result.secrets.CONFIRMATION_TOKEN_TTL).toBe('86400');
      expect(result.secrets.RESEND_API_KEY).toBe('');
      expect(result.secrets.EMAIL_FROM).toBe('noreply@example.com');
      expect(result.secrets.EMAIL_PROVIDER).toBe('console');
      // KONG_TRUST_TOKEN moved to framework file
      expect(result.secrets.KONG_TRUST_TOKEN).toBeUndefined();
    });

    it('should include KONG_CORS_ORIGINS when frontends exist', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'frontend', type: 'nextjs', port: 3000 }],
      });

      rs.mocked(
        autoDetectAllowedOriginsModule.autoDetectAllowedOrigins,
      ).mockReturnValue('http://localhost:3000');

      const result = generateUserSecretsFile(config);

      expect(result.secrets.KONG_CORS_ORIGINS).toBe('http://localhost:3000');
    });

    it('should omit KONG_CORS_ORIGINS when no frontends exist', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'api', type: 'nestjs', port: 3001 }],
      });

      rs.mocked(
        autoDetectAllowedOriginsModule.autoDetectAllowedOrigins,
      ).mockReturnValue(null);

      const result = generateUserSecretsFile(config);

      expect(result.secrets.KONG_CORS_ORIGINS).toBeUndefined();
    });
  });

  describe('JWT keys generation', () => {
    it('should not generate JWT keys (moved to framework file)', () => {
      const config = createMockFrameworkConfig({
        framework: { template: 'auth' },
      });

      const result = generateUserSecretsFile(config);

      // JWT keys are now generated in framework file, not user file
      expect(
        generateRSAKeyPairModule.generateRSAKeyPair,
      ).not.toHaveBeenCalled();
      expect(result.secrets.JWT_PRIVATE_KEY_CURRENT).toBeUndefined();
      expect(result.secrets.JWT_PUBLIC_KEY_CURRENT).toBeUndefined();
      expect(result.secrets.JWT_KEY_ID_CURRENT).toBeUndefined();
    });

    it('should not generate JWT keys when auth template is disabled', () => {
      const config = createMockFrameworkConfig({
        framework: { template: null },
      });

      const result = generateUserSecretsFile(config);

      expect(
        generateRSAKeyPairModule.generateRSAKeyPair,
      ).not.toHaveBeenCalled();
      expect(result.secrets.JWT_PRIVATE_KEY_CURRENT).toBeUndefined();
      expect(result.secrets.JWT_PUBLIC_KEY_CURRENT).toBeUndefined();
      expect(result.secrets.JWT_KEY_ID_CURRENT).toBeUndefined();
    });

    it('should not generate JWT keys when auth template is undefined', () => {
      const config = createMockFrameworkConfig();

      const result = generateUserSecretsFile(config);

      expect(
        generateRSAKeyPairModule.generateRSAKeyPair,
      ).not.toHaveBeenCalled();
      expect(result.secrets.JWT_PRIVATE_KEY_CURRENT).toBeUndefined();
    });

    it('should not generate JWT keys when framework field is missing', () => {
      const config = createMockFrameworkConfig();

      const result = generateUserSecretsFile(config);

      expect(
        generateRSAKeyPairModule.generateRSAKeyPair,
      ).not.toHaveBeenCalled();
      expect(result.secrets.JWT_PRIVATE_KEY_CURRENT).toBeUndefined();
    });
  });

  describe('Service sections', () => {
    it('should create service section for each service', () => {
      const config = createMockFrameworkConfig({
        services: [
          { name: 'auth-service', type: 'nestjs', port: 3001 },
          { name: 'frontend', type: 'nextjs', port: 3000 },
        ],
      });

      rs.mocked(
        autoDetectAllowedOriginsModule.autoDetectAllowedOrigins,
      ).mockReturnValue('http://localhost:3000');
      rs.mocked(
        createServiceSectionModule.createServiceSection,
      ).mockReturnValue({ secrets: ['NODE_ENV'] });

      const result = generateUserSecretsFile(config);

      expect(
        createServiceSectionModule.createServiceSection,
      ).toHaveBeenCalledTimes(2);
      expect(
        createServiceSectionModule.createServiceSection,
      ).toHaveBeenCalledWith(config.services[0]);
      expect(
        createServiceSectionModule.createServiceSection,
      ).toHaveBeenCalledWith(config.services[1]);

      expect(result['auth-service']).toBeDefined();
      expect(result['frontend']).toBeDefined();
    });

    it('should create service sections without allowedOrigins parameter', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'api', type: 'nestjs', port: 3001 }],
      });

      generateUserSecretsFile(config);

      expect(
        createServiceSectionModule.createServiceSection,
      ).toHaveBeenCalledWith(config.services[0]);
    });
  });

  describe('Service API keys and URLs', () => {
    it('should not generate service API keys (moved to framework file)', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      generateUserSecretsFile(config);

      // Service API keys are now generated in framework file, not user file
      expect(
        generateServiceApiKeysModule.generateServiceApiKeys,
      ).not.toHaveBeenCalled();
    });

    it('should not generate service URLs (moved to framework file)', () => {
      const config = createMockFrameworkConfig({
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      const result = generateUserSecretsFile(config);

      // Service URLs are now in framework file, not user file
      expect(result.secrets.AUTH_SERVICE_URL).toBeUndefined();
    });
  });

  describe('JWT keys added to auth service', () => {
    it('should add JWT keys to auth service when auth template is enabled', () => {
      const config = createMockFrameworkConfig({
        framework: { template: 'auth' },
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      generateUserSecretsFile(config);

      expect(
        addJwtKeysToAuthServiceModule.addJwtKeysToAuthService,
      ).toHaveBeenCalledTimes(1);
      expect(
        addJwtKeysToAuthServiceModule.addJwtKeysToAuthService,
      ).toHaveBeenCalledWith(expect.any(Object), true);
    });

    it('should not add JWT keys to auth service when auth template is disabled', () => {
      const config = createMockFrameworkConfig({
        framework: { template: null },
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      });

      generateUserSecretsFile(config);

      expect(
        addJwtKeysToAuthServiceModule.addJwtKeysToAuthService,
      ).toHaveBeenCalledWith(expect.any(Object), false);
    });
  });

  describe('Instructions and metadata', () => {
    it('should include instructions with correct steps', () => {
      const config = createMockFrameworkConfig();

      const result = generateUserSecretsFile(config);

      expect(result.$instructions!['1']).toContain('custom secrets');
      expect(result.$instructions!['2']).toContain('Reference them');
      expect(result.$instructions!['3']).toContain(
        'npx tsdevstack generate-secrets',
      );
      expect(result.$instructions!['4']).toContain('Restart your services');
    });

    it('should include important notes', () => {
      const config = createMockFrameworkConfig();

      const result = generateUserSecretsFile(config);

      expect(result.$important!.safe_to_edit).toContain('SAFE to edit');
      expect(result.$important!.local_only).toContain('LOCAL development');
      expect(result.$important!.framework_secrets).toContain('auto-generated');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty services array', () => {
      const config = createMockFrameworkConfig();

      const result = generateUserSecretsFile(config);

      expect(result.secrets).toBeDefined();
      expect(
        createServiceSectionModule.createServiceSection,
      ).not.toHaveBeenCalled();
    });

    it('should handle config with both backend and frontend services', () => {
      const config = createMockFrameworkConfig({
        services: [
          { name: 'auth-service', type: 'nestjs', port: 3001 },
          { name: 'frontend', type: 'nextjs', port: 3000 },
          { name: 'api', type: 'nestjs', port: 3002 },
        ],
      });

      const result = generateUserSecretsFile(config);

      expect(
        createServiceSectionModule.createServiceSection,
      ).toHaveBeenCalledTimes(3);
      expect(result['auth-service']).toBeDefined();
      expect(result['frontend']).toBeDefined();
      expect(result['api']).toBeDefined();
    });
  });
});
