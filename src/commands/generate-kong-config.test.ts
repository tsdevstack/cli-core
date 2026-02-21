import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import * as secretsModule from '../utils/secrets';
import * as loggerModule from '../utils/logger';
import * as fsModule from '../utils/fs';
import * as kongModule from '../utils/kong';
import * as kongSecurityModule from '../utils/kong/generate-security-routes';
import * as kongMergeModule from '../utils/kong/merge-kong-configs';
import * as findProjectRootModule from '../utils/paths/find-project-root';
import * as configModule from '../utils/config';
import * as openapiModule from '../utils/openapi';
import { generateKongConfig } from './generate-kong-config';
import type { FrameworkConfig } from '../utils/config';
import { CliError } from '../utils/errors';

rs.mock('../utils/secrets', { mock: true });
rs.mock('../utils/logger', { mock: true });
rs.mock('../utils/fs', { mock: true });
rs.mock('../utils/kong', { mock: true });
rs.mock('../utils/kong/generate-security-routes', { mock: true });
rs.mock('../utils/kong/merge-kong-configs', { mock: true });
rs.mock('../utils/paths/find-project-root', { mock: true });
rs.mock('../utils/config', { mock: true });
rs.mock('../utils/openapi', { mock: true });

describe('generateKongConfig', () => {
  const mockLogger = {
    generating: rs.fn(),
    loading: rs.fn(),
    checking: rs.fn(),
    success: rs.fn(),
    info: rs.fn(),
    warn: rs.fn(),
    complete: rs.fn(),
    newline: rs.fn(),
  };

  const mockSecrets: Record<string, string> = {
    AUTH_SERVICE_URL: 'http://localhost:3001',
    USER_SERVICE_URL: 'http://localhost:3002',
    OIDC_DISCOVERY_URL:
      'https://auth.example.com/.well-known/openid-configuration',
  };

  const mockConfigWithAuth: FrameworkConfig = {
    project: { name: 'test-project', version: '1.0.0' },
    framework: { template: 'auth' },
    cloud: { provider: null },
    services: [
      {
        name: 'auth-service',
        type: 'nestjs',
        port: 3001,
        globalPrefix: 'auth',
      },
      {
        name: 'user-service',
        type: 'nestjs',
        port: 3002,
        globalPrefix: 'users',
      },
    ],
  };

  const mockConfigNoAuth: FrameworkConfig = {
    project: { name: 'test-project', version: '1.0.0' },
    framework: { template: null },
    cloud: { provider: null },
    services: [
      {
        name: 'user-service',
        type: 'nestjs',
        port: 3002,
        globalPrefix: 'users',
      },
    ],
  };

  const mockParsedSecurity = {
    serviceName: 'user-service',
    openApiPath: '/mock/project/apps/user-service/docs/openapi.json',
    groupedRoutes: {
      public: [{ path: '/users', method: 'GET' }],
      jwt: [{ path: '/users/me', method: 'GET' }],
      partner: [],
    },
  };

  const mockKongServices = [
    {
      name: 'user-service-public',
      url: 'http://localhost:3002',
      routes: [{ paths: ['/users'] }],
    },
  ];

  beforeEach(() => {
    rs.clearAllMocks();

    rs.mocked(loggerModule.logger).generating = mockLogger.generating;
    rs.mocked(loggerModule.logger).loading = mockLogger.loading;
    rs.mocked(loggerModule.logger).checking = mockLogger.checking;
    rs.mocked(loggerModule.logger).success = mockLogger.success;
    rs.mocked(loggerModule.logger).info = mockLogger.info;
    rs.mocked(loggerModule.logger).warn = mockLogger.warn;
    rs.mocked(loggerModule.logger).complete = mockLogger.complete;
    rs.mocked(loggerModule.logger).newline = mockLogger.newline;

    rs.mocked(findProjectRootModule.findProjectRoot).mockReturnValue(
      '/mock/project',
    );
    rs.mocked(secretsModule.loadLocalSecrets).mockReturnValue({
      ...mockSecrets,
    });
    rs.mocked(configModule.hasAuthTemplate).mockReturnValue(false);
    rs.mocked(fsModule.isFile).mockReturnValue(false);
    rs.mocked(openapiModule.parseOpenApiSecurity).mockReturnValue(
      mockParsedSecurity as unknown as ReturnType<
        typeof openapiModule.parseOpenApiSecurity
      >,
    );
    rs.mocked(kongSecurityModule.generateSecurityBasedServices).mockReturnValue(
      mockKongServices as unknown as ReturnType<
        typeof kongSecurityModule.generateSecurityBasedServices
      >,
    );
    rs.mocked(kongMergeModule.mergeKongConfigs).mockImplementation(
      ((a: unknown) => a) as typeof kongMergeModule.mergeKongConfigs,
    );
    rs.mocked(kongModule.resolveEnvVars).mockImplementation(
      ((config: unknown) => config) as typeof kongModule.resolveEnvVars,
    );
    rs.mocked(kongModule.getDefaultKongPlugins).mockReturnValue([]);
    rs.mocked(secretsModule.getRequiredSecret).mockReturnValue(
      'http://localhost:3001',
    );
  });

  describe('Escape hatch mode', () => {
    it('should use custom config when kong.custom.yml exists', () => {
      const customConfig = { _format_version: '3.0', services: [] };
      rs.mocked(fsModule.isFile).mockImplementation((p: string) =>
        p.endsWith('kong.custom.yml'),
      );
      rs.mocked(fsModule.readYamlFile).mockReturnValue(customConfig);

      generateKongConfig();

      expect(fsModule.readYamlFile).toHaveBeenCalledWith(
        '/mock/project/kong.custom.yml',
      );
      expect(kongModule.resolveEnvVars).toHaveBeenCalled();
      expect(kongModule.processCorsOrigins).toHaveBeenCalled();
      expect(fsModule.writeYamlFile).toHaveBeenCalledTimes(1);
    });

    it('should not generate framework or user configs in escape hatch', () => {
      rs.mocked(fsModule.isFile).mockImplementation((p: string) =>
        p.endsWith('kong.custom.yml'),
      );
      rs.mocked(fsModule.readYamlFile).mockReturnValue({
        _format_version: '3.0',
      });

      generateKongConfig();

      expect(openapiModule.parseOpenApiSecurity).not.toHaveBeenCalled();
      expect(
        kongSecurityModule.generateSecurityBasedServices,
      ).not.toHaveBeenCalled();
    });
  });

  describe('Normal mode - auth template', () => {
    beforeEach(() => {
      rs.mocked(configModule.loadFrameworkConfig).mockReturnValue(
        mockConfigWithAuth,
      );
      rs.mocked(configModule.hasAuthTemplate).mockReturnValue(true);
      // isFile: false for kong.custom.yml, true for openapi.json
      rs.mocked(fsModule.isFile).mockImplementation((p: string) =>
        p.endsWith('openapi.json'),
      );
      // kong.user.yml doesn't exist
      rs.mocked(fsModule.readYamlFile).mockReturnValue({
        _format_version: '3.0',
        services: [],
      });
    });

    it('should throw when auth-service not found in config', () => {
      rs.mocked(configModule.loadFrameworkConfig).mockReturnValue({
        ...mockConfigWithAuth,
        services: [{ name: 'user-service', type: 'nestjs', port: 3002 }],
      });

      expect(() => generateKongConfig()).toThrow(CliError);
    });

    it('should get AUTH_SERVICE_URL from secrets', () => {
      generateKongConfig();

      expect(secretsModule.getRequiredSecret).toHaveBeenCalledWith(
        expect.any(Object),
        'AUTH_SERVICE_URL',
        expect.any(String),
      );
    });
  });

  describe('Normal mode - OpenAPI parsing', () => {
    beforeEach(() => {
      rs.mocked(configModule.loadFrameworkConfig).mockReturnValue(
        mockConfigNoAuth,
      );
      rs.mocked(fsModule.isFile).mockImplementation((p: string) =>
        p.endsWith('openapi.json'),
      );
    });

    it('should parse OpenAPI specs for NestJS services', () => {
      generateKongConfig();

      expect(openapiModule.parseOpenApiSecurity).toHaveBeenCalledWith(
        'user-service',
        '/mock/project/apps/user-service/docs/openapi.json',
      );
    });

    it('should skip non-NestJS services', () => {
      rs.mocked(configModule.loadFrameworkConfig).mockReturnValue({
        ...mockConfigNoAuth,
        services: [
          { name: 'frontend', type: 'nextjs', port: 3000 },
          { name: 'user-service', type: 'nestjs', port: 3002 },
        ],
      });

      generateKongConfig();

      expect(openapiModule.parseOpenApiSecurity).toHaveBeenCalledTimes(1);
      expect(openapiModule.parseOpenApiSecurity).toHaveBeenCalledWith(
        'user-service',
        expect.any(String),
      );
    });

    it('should skip services without openapi.json', () => {
      rs.mocked(fsModule.isFile).mockReturnValue(false);

      expect(() => generateKongConfig()).toThrow(CliError);
    });

    it('should throw when no valid OpenAPI specs found', () => {
      rs.mocked(fsModule.isFile).mockReturnValue(false);

      expect(() => generateKongConfig()).toThrow(CliError);
    });
  });

  describe('Normal mode - Kong generation', () => {
    beforeEach(() => {
      rs.mocked(configModule.loadFrameworkConfig).mockReturnValue(
        mockConfigNoAuth,
      );
      rs.mocked(fsModule.isFile).mockImplementation((p: string) =>
        p.endsWith('openapi.json'),
      );
    });

    it('should generate security-based services', () => {
      generateKongConfig();

      expect(
        kongSecurityModule.generateSecurityBasedServices,
      ).toHaveBeenCalled();
    });

    it('should warn when service URL not found in secrets', () => {
      rs.mocked(secretsModule.loadLocalSecrets).mockReturnValue({});

      generateKongConfig();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('USER_SERVICE_URL'),
      );
    });

    it('should write kong.tsdevstack.yml', () => {
      generateKongConfig();

      const writeCalls = rs.mocked(fsModule.writeYamlFile).mock.calls;
      const tsdevstackWrite = writeCalls.find((call) =>
        (call[0] as string).endsWith('kong.tsdevstack.yml'),
      );
      expect(tsdevstackWrite).toBeDefined();
    });

    it('should create kong.user.yml when it does not exist', () => {
      // isFile returns true for openapi.json, false for kong.user.yml and kong.custom.yml
      rs.mocked(fsModule.isFile).mockImplementation((p: string) =>
        p.endsWith('openapi.json'),
      );

      generateKongConfig();

      expect(kongModule.getDefaultKongPlugins).toHaveBeenCalled();
    });

    it('should preserve existing kong.user.yml', () => {
      const existingUserConfig = {
        _format_version: '3.0',
        services: [],
        plugins: [],
      };
      rs.mocked(fsModule.isFile).mockImplementation(
        (p: string) =>
          p.endsWith('openapi.json') || p.endsWith('kong.user.yml'),
      );
      rs.mocked(fsModule.readYamlFile).mockReturnValue(existingUserConfig);

      generateKongConfig();

      expect(kongModule.getDefaultKongPlugins).not.toHaveBeenCalled();
    });

    it('should merge configs and write final kong.yml', () => {
      generateKongConfig();

      expect(kongMergeModule.mergeKongConfigs).toHaveBeenCalled();
      expect(kongModule.resolveEnvVars).toHaveBeenCalled();
      expect(kongModule.processCorsOrigins).toHaveBeenCalled();

      const writeCalls = rs.mocked(fsModule.writeYamlFile).mock.calls;
      const kongWrite = writeCalls.find((call) =>
        (call[0] as string).endsWith('kong.yml'),
      );
      expect(kongWrite).toBeDefined();
    });
  });
});
