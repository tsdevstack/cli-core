/**
 * Integration tests for generate-kong-config command
 * Tests the full command flow with mocked dependencies
 */

import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { generateKongConfig } from './generate-kong-config';
import type { FrameworkConfig } from '../utils/config';
import type { SecretsFile } from '../utils/secrets';

// Mock all dependencies
rs.mock('../utils/config', { mock: true });
rs.mock('../utils/secrets', { mock: true });
rs.mock('../utils/logger', { mock: true });
rs.mock('../utils/fs', { mock: true });
rs.mock('../utils/paths/find-project-root', { mock: true });
rs.mock('../utils/openapi', { mock: true });
rs.mock('../utils/kong', { mock: true });
rs.mock('../utils/kong/generate-security-routes', { mock: true });
rs.mock('../utils/kong/merge-kong-configs', { mock: true });

describe('generateKongConfig - Integration Tests', () => {
  const mockLogger = {
    generating: rs.fn(),
    loading: rs.fn(),
    checking: rs.fn(),
    updating: rs.fn(),
    success: rs.fn(),
    info: rs.fn(),
    warn: rs.fn(),
    complete: rs.fn(),
    newline: rs.fn(),
  };

  const mockConfig: FrameworkConfig = {
    project: {
      name: 'test-project',
      version: '1.0.0',
    },
    cloud: { provider: null },
    services: [
      {
        name: 'auth-service',
        type: 'nestjs',
        port: 3001,
      },
      {
        name: 'api-service',
        type: 'nestjs',
        port: 3002,
      },
    ],
    framework: {
      template: 'fullstack-auth',
    },
  };

  const mockSecrets = {
    AUTH_SERVICE_URL: 'http://localhost:3001',
    API_SERVICE_URL: 'http://localhost:3002',
    KONG_SERVICE_HOST: 'localhost',
    KONG_CORS_ORIGINS: 'http://localhost:3000,http://localhost:3001',
  };

  const mockSecretsFile: SecretsFile = {
    secrets: {},
  };

  beforeEach(async () => {
    rs.clearAllMocks();

    // Mock logger
    const loggerModule = await import('../utils/logger');
    rs.mocked(loggerModule.logger).generating = mockLogger.generating;
    rs.mocked(loggerModule.logger).loading = mockLogger.loading;
    rs.mocked(loggerModule.logger).success = mockLogger.success;
    rs.mocked(loggerModule.logger).info = mockLogger.info;
    rs.mocked(loggerModule.logger).warn = mockLogger.warn;
    rs.mocked(loggerModule.logger).complete = mockLogger.complete;
    rs.mocked(loggerModule.logger).newline = mockLogger.newline;

    // Mock config loading
    const configModule = await import('../utils/config');
    rs.mocked(configModule.loadFrameworkConfig).mockReturnValue(mockConfig);
    rs.mocked(configModule.hasAuthTemplate).mockReturnValue(true);

    // Mock secrets loading
    const secretsModule = await import('../utils/secrets');
    rs.mocked(secretsModule.loadLocalSecrets).mockReturnValue(mockSecrets);
    rs.mocked(secretsModule.loadLocalSecretsFile).mockReturnValue(
      mockSecretsFile,
    );
    rs.mocked(secretsModule.getRequiredSecret).mockImplementation(
      (secrets, key) => secrets[key] as string,
    );

    // Mock project root
    const pathsModule = await import('../utils/paths/find-project-root');
    rs.mocked(pathsModule.findProjectRoot).mockReturnValue('/project/root');

    // Mock file system
    const fsModule = await import('../utils/fs');
    rs.mocked(fsModule.isFile).mockReturnValue(false); // No custom config by default
    rs.mocked(fsModule.writeYamlFile).mockImplementation(() => {});
    rs.mocked(fsModule.writeTextFile).mockImplementation(() => {});
    rs.mocked(fsModule.readYamlFile).mockReturnValue({});

    // Mock OpenAPI parsing
    const openapiModule = await import('../utils/openapi');
    rs.mocked(openapiModule.parseOpenApiSecurity).mockReturnValue({
      serviceName: 'test-service',
      openApiPath: '/test/openapi.json',
      groupedRoutes: {
        public: [
          { path: '/health', method: 'GET', securityType: 'public' },
          { path: '/docs', method: 'GET', securityType: 'public' },
        ],
        jwt: [
          { path: '/api/users', method: 'GET', securityType: 'jwt' },
          { path: '/api/profile', method: 'GET', securityType: 'jwt' },
        ],
        partner: [
          {
            path: '/api/partner/webhook',
            method: 'POST',
            securityType: 'partner',
          },
        ],
      },
    });

    // Mock Kong utilities
    const kongModule = await import('../utils/kong');
    rs.mocked(kongModule.resolveEnvVars).mockImplementation((obj) => obj);
    rs.mocked(kongModule.getDefaultKongPlugins).mockReturnValue([
      { name: 'cors', config: { origins: '${KONG_CORS_ORIGINS}' } },
    ]);
    rs.mocked(kongModule.processCorsOrigins).mockImplementation(() => {});

    // Mock security routes generation
    const securityRoutesModule =
      await import('../utils/kong/generate-security-routes');
    rs.mocked(
      securityRoutesModule.generateSecurityBasedServices,
    ).mockReturnValue([
      {
        name: 'api-service-public',
        url: '${KONG_SERVICE_HOST}:3002',
        routes: [
          {
            name: 'api-service-public-routes',
            paths: ['/health', '/docs'],
            strip_path: false,
          },
        ],
      },
      {
        name: 'api-service-jwt',
        url: '${KONG_SERVICE_HOST}:3002',
        routes: [
          {
            name: 'api-service-jwt-routes',
            paths: ['/api/users', '/api/profile'],
            strip_path: false,
          },
        ],
        plugins: [{ name: 'oidc', config: {} }],
      },
    ]);

    // Mock config merging
    const mergeModule = await import('../utils/kong/merge-kong-configs');
    rs.mocked(mergeModule.mergeKongConfigs).mockImplementation(
      (framework, user) => ({
        ...framework,
        plugins: user.plugins,
      }),
    );
  });

  describe('Standard Auth Mode', () => {
    beforeEach(async () => {
      const fsModule = await import('../utils/fs');
      rs.mocked(fsModule.isFile).mockImplementation((path) => {
        // Simulate that openapi.json exists for both services
        return path.toString().includes('openapi.json');
      });
    });

    it('should generate Kong configuration successfully', () => {
      generateKongConfig();

      expect(mockLogger.generating).toHaveBeenCalledWith(
        'Generating Kong configuration (4-file/3+1 system)...',
      );
      expect(mockLogger.complete).toHaveBeenCalledWith(
        'Kong configuration generated successfully!',
      );
    });

    it('should load framework config and secrets', async () => {
      const configModule = await import('../utils/config');
      const secretsModule = await import('../utils/secrets');

      generateKongConfig();

      expect(configModule.loadFrameworkConfig).toHaveBeenCalled();
      expect(secretsModule.loadLocalSecrets).toHaveBeenCalled();
    });

    it('should validate auth-service exists', async () => {
      const secretsModule = await import('../utils/secrets');

      generateKongConfig();

      expect(secretsModule.getRequiredSecret).toHaveBeenCalledWith(
        mockSecrets,
        'AUTH_SERVICE_URL',
        expect.any(String),
      );
    });

    it('should parse OpenAPI specs for NestJS services', async () => {
      const openapiModule = await import('../utils/openapi');

      generateKongConfig();

      expect(openapiModule.parseOpenApiSecurity).toHaveBeenCalledTimes(2);
      expect(openapiModule.parseOpenApiSecurity).toHaveBeenCalledWith(
        'auth-service',
        '/project/root/apps/auth-service/docs/openapi.json',
      );
      expect(openapiModule.parseOpenApiSecurity).toHaveBeenCalledWith(
        'api-service',
        '/project/root/apps/api-service/docs/openapi.json',
      );
    });

    it('should generate security-based services', async () => {
      const securityRoutesModule =
        await import('../utils/kong/generate-security-routes');

      generateKongConfig();

      expect(
        securityRoutesModule.generateSecurityBasedServices,
      ).toHaveBeenCalled();
    });

    it('should write kong.tsdevstack.yml', async () => {
      const fsModule = await import('../utils/fs');

      generateKongConfig();

      expect(fsModule.writeYamlFile).toHaveBeenCalledWith(
        '/project/root/kong.tsdevstack.yml',
        expect.objectContaining({
          _format_version: '3.0',
          _transform: true,
        }),
      );
    });

    it('should create kong.user.yml if it does not exist', async () => {
      const fsModule = await import('../utils/fs');
      const kongModule = await import('../utils/kong');

      generateKongConfig();

      expect(fsModule.writeYamlFile).toHaveBeenCalledWith(
        '/project/root/kong.user.yml',
        expect.objectContaining({
          _format_version: '3.0',
          _transform: true,
          services: [],
        }),
      );
      expect(kongModule.getDefaultKongPlugins).toHaveBeenCalled();
    });

    it('should merge framework and user configs', async () => {
      const mergeModule = await import('../utils/kong/merge-kong-configs');

      generateKongConfig();

      expect(mergeModule.mergeKongConfigs).toHaveBeenCalled();
    });

    it('should resolve environment variables', async () => {
      const kongModule = await import('../utils/kong');

      generateKongConfig();

      expect(kongModule.resolveEnvVars).toHaveBeenCalled();
    });

    it('should process CORS origins', async () => {
      const kongModule = await import('../utils/kong');

      generateKongConfig();

      expect(kongModule.processCorsOrigins).toHaveBeenCalled();
    });

    it('should write final kong.yml', async () => {
      const fsModule = await import('../utils/fs');

      generateKongConfig();

      expect(fsModule.writeYamlFile).toHaveBeenCalledWith(
        '/project/root/kong.yml',
        expect.any(Object),
      );
    });
  });

  describe('Custom Config Escape Hatch', () => {
    beforeEach(async () => {
      const fsModule = await import('../utils/fs');
      rs.mocked(fsModule.isFile).mockImplementation((path) => {
        // Simulate kong.custom.yml exists
        return path.toString().includes('kong.custom.yml');
      });
      rs.mocked(fsModule.readYamlFile).mockReturnValue({
        _format_version: '3.0',
        services: [
          { name: 'custom-service', url: 'http://custom:3000', routes: [] },
        ],
        plugins: [
          { name: 'cors', config: { origins: '${KONG_CORS_ORIGINS}' } },
        ],
      });
    });

    it('should use kong.custom.yml if it exists', () => {
      generateKongConfig();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'kong.custom.yml detected - Using custom Kong configuration',
      );
      expect(mockLogger.complete).toHaveBeenCalledWith(
        'Kong configuration generated (custom mode)!',
      );
    });

    it('should skip framework route generation in custom mode', async () => {
      const openapiModule = await import('../utils/openapi');

      generateKongConfig();

      expect(openapiModule.parseOpenApiSecurity).not.toHaveBeenCalled();
    });

    it('should read custom config file', async () => {
      const fsModule = await import('../utils/fs');

      generateKongConfig();

      expect(fsModule.readYamlFile).toHaveBeenCalledWith(
        '/project/root/kong.custom.yml',
      );
    });

    it('should resolve placeholders in custom config', async () => {
      const kongModule = await import('../utils/kong');

      generateKongConfig();

      expect(kongModule.resolveEnvVars).toHaveBeenCalled();
      expect(kongModule.processCorsOrigins).toHaveBeenCalled();
    });

    it('should write only kong.yml in custom mode', async () => {
      const fsModule = await import('../utils/fs');

      generateKongConfig();

      const writeYamlCalls = rs.mocked(fsModule.writeYamlFile).mock.calls;
      const writtenFiles = writeYamlCalls.map((call) => call[0]);

      expect(writtenFiles).toContain('/project/root/kong.yml');
      expect(writtenFiles).not.toContain('/project/root/kong.tsdevstack.yml');
      expect(writtenFiles).not.toContain('/project/root/kong.user.yml');
    });
  });

  describe('No-Auth Template Mode', () => {
    beforeEach(async () => {
      const configModule = await import('../utils/config');
      rs.mocked(configModule.loadFrameworkConfig).mockReturnValue({
        ...mockConfig,
        services: mockConfig.services.filter((s) => s.name !== 'auth-service'),
        framework: {
          template: null, // No auth template
        },
      });
      rs.mocked(configModule.hasAuthTemplate).mockReturnValue(false);

      const fsModule = await import('../utils/fs');
      rs.mocked(fsModule.isFile).mockImplementation((path) => {
        return path.toString().includes('openapi.json');
      });
    });

    it('should still generate routes from OpenAPI specs without auth template', async () => {
      const openapiModule = await import('../utils/openapi');

      generateKongConfig();

      // Routes are still generated, just without auth service validation
      expect(openapiModule.parseOpenApiSecurity).toHaveBeenCalled();
    });

    it('should log info about external OIDC mode', () => {
      generateKongConfig();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'No auth template - routes will use external OIDC provider',
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw error if auth-service not found in auth mode', async () => {
      const configModule = await import('../utils/config');
      rs.mocked(configModule.loadFrameworkConfig).mockReturnValue({
        ...mockConfig,
        services: mockConfig.services.filter((s) => s.name !== 'auth-service'),
      });

      expect(() => generateKongConfig()).toThrow();
    });

    it('should throw error if AUTH_SERVICE_URL missing port', async () => {
      const secretsModule = await import('../utils/secrets');
      rs.mocked(secretsModule.getRequiredSecret).mockReturnValue(
        'http://localhost', // No port
      );

      expect(() => generateKongConfig()).toThrow();
    });

    it('should throw error if no NestJS services with OpenAPI specs', async () => {
      const configModule = await import('../utils/config');
      const frontendType = 'frontend' as const;
      rs.mocked(configModule.loadFrameworkConfig).mockReturnValue({
        ...mockConfig,
        services: mockConfig.services.map((s) => ({
          ...s,
          type: frontendType,
        })),
      });

      expect(() => generateKongConfig()).toThrow();
    });
  });

  describe('Existing kong.user.yml', () => {
    beforeEach(async () => {
      const fsModule = await import('../utils/fs');
      rs.mocked(fsModule.isFile).mockImplementation((path) => {
        // Simulate both openapi.json and kong.user.yml exist
        return (
          path.toString().includes('openapi.json') ||
          path.toString().includes('kong.user.yml')
        );
      });
      rs.mocked(fsModule.readYamlFile).mockReturnValue({
        _format_version: '3.0',
        services: [],
        plugins: [{ name: 'custom-plugin', config: {} }],
      });
    });

    it('should use existing kong.user.yml if present', async () => {
      const fsModule = await import('../utils/fs');

      generateKongConfig();

      expect(mockLogger.info).toHaveBeenCalledWith(
        '   kong.user.yml exists - using existing file',
      );
      expect(fsModule.readYamlFile).toHaveBeenCalledWith(
        '/project/root/kong.user.yml',
      );
    });

    it('should not overwrite existing kong.user.yml', async () => {
      const fsModule = await import('../utils/fs');

      generateKongConfig();

      const writeYamlCalls = rs.mocked(fsModule.writeYamlFile).mock.calls;
      const userYamlWrites = writeYamlCalls.filter(
        (call) => call[0] === '/project/root/kong.user.yml',
      );

      expect(userYamlWrites).toHaveLength(0);
    });
  });
});
