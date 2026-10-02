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
import * as localKongContextModule from '../utils/kong/write-local-kong-build-context';
import * as validateTransformerModule from '../utils/kong/validate-request-transformer-headers';
import * as validateStripModule from '../utils/kong/validate-strip-identity-plugin';
import * as warnConsumersModule from '../utils/kong/warn-static-partner-consumers';
import * as defaultLimitsModule from '../utils/kong/build-api-key-default-limits';
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
rs.mock('../utils/kong/write-local-kong-build-context', { mock: true });
rs.mock('../utils/kong/validate-request-transformer-headers', { mock: true });
rs.mock('../utils/kong/validate-strip-identity-plugin', { mock: true });
rs.mock('../utils/kong/warn-static-partner-consumers', { mock: true });
rs.mock('../utils/kong/build-api-key-default-limits', { mock: true });

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

    it('should check kong.custom.yml for the strip plugin and identity header removal', () => {
      const customConfig = { _format_version: '3.0', services: [] };
      rs.mocked(fsModule.isFile).mockImplementation((p: string) =>
        p.endsWith('kong.custom.yml'),
      );
      rs.mocked(fsModule.readYamlFile).mockReturnValue(customConfig);

      generateKongConfig();

      expect(
        validateStripModule.validateStripIdentityPlugin,
      ).toHaveBeenCalledWith(customConfig, 'kong.custom.yml');
      expect(
        validateTransformerModule.validateRequestTransformerHeaders,
      ).toHaveBeenCalledWith(customConfig, 'kong.custom.yml');
    });

    it('should write the local Kong image build context', () => {
      rs.mocked(fsModule.isFile).mockImplementation((p: string) =>
        p.endsWith('kong.custom.yml'),
      );
      rs.mocked(fsModule.readYamlFile).mockReturnValue({
        _format_version: '3.0',
      });

      generateKongConfig();

      expect(
        localKongContextModule.writeLocalKongBuildContext,
      ).toHaveBeenCalledWith('/mock/project');
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

    it('should write the framework global plugins into kong.tsdevstack.yml', () => {
      generateKongConfig();

      const tsdevstackWrite = rs
        .mocked(fsModule.writeYamlFile)
        .mock.calls.find((call) =>
          (call[0] as string).endsWith('kong.tsdevstack.yml'),
        );
      expect(tsdevstackWrite![1]).toEqual(
        expect.objectContaining({
          services: mockKongServices,
          plugins: [{ name: 'tsdevstack-strip-identity', config: {} }],
        }),
      );
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
      expect(
        validateTransformerModule.validateRequestTransformerHeaders,
      ).toHaveBeenCalledWith(existingUserConfig, 'kong.user.yml');
    });

    it('should write a new kong.user.yml as plain YAML without injected comments', () => {
      generateKongConfig();

      const userWrite = rs
        .mocked(fsModule.writeYamlFile)
        .mock.calls.find((call) =>
          (call[0] as string).endsWith('kong.user.yml'),
        );
      expect(userWrite).toBeDefined();
      expect(fsModule.writeTextFile).not.toHaveBeenCalled();
      expect(
        validateTransformerModule.validateRequestTransformerHeaders,
      ).not.toHaveBeenCalled();
    });

    it('should write the local Kong image build context after kong.yml', () => {
      generateKongConfig();

      expect(
        localKongContextModule.writeLocalKongBuildContext,
      ).toHaveBeenCalledWith('/mock/project');
      const writeOrder = rs.mocked(fsModule.writeYamlFile).mock
        .invocationCallOrder;
      const contextOrder = rs.mocked(
        localKongContextModule.writeLocalKongBuildContext,
      ).mock.invocationCallOrder[0];
      expect(contextOrder).toBeGreaterThan(Math.max(...writeOrder));
    });

    it('should use the configured globalPrefix', () => {
      generateKongConfig();

      expect(
        kongSecurityModule.generateSecurityBasedServices,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'user-service',
          globalPrefix: 'users',
        }),
      );
    });

    it('should fall back to the shared rule (name without -service) when globalPrefix is unset', () => {
      rs.mocked(configModule.loadFrameworkConfig).mockReturnValue({
        ...mockConfigNoAuth,
        services: [{ name: 'user-service', type: 'nestjs', port: 3002 }],
      });

      generateKongConfig();

      expect(
        kongSecurityModule.generateSecurityBasedServices,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceName: 'user-service',
          globalPrefix: 'user',
        }),
      );
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

  describe('Normal mode - partner API keys', () => {
    const partnerParsed = {
      ...mockParsedSecurity,
      groupedRoutes: {
        ...mockParsedSecurity.groupedRoutes,
        partner: [{ path: '/users/v1/list', method: 'GET' }],
      },
    };
    const userConfig = {
      _format_version: '3.0',
      services: [],
      plugins: [{ name: 'rate-limiting', config: { minute: 100 } }],
    };

    beforeEach(() => {
      rs.mocked(configModule.loadFrameworkConfig).mockReturnValue(
        mockConfigNoAuth,
      );
      rs.mocked(fsModule.isFile).mockImplementation(
        (p: string) =>
          p.endsWith('openapi.json') || p.endsWith('kong.user.yml'),
      );
      rs.mocked(fsModule.readYamlFile).mockReturnValue(userConfig);
      rs.mocked(configModule.resolveApiKeyIpLimit).mockReturnValue(120);
      rs.mocked(defaultLimitsModule.buildApiKeyDefaultLimits).mockReturnValue({
        minute: 100,
      });
    });

    it('should pass the default limits from kong.user.yml and the per-IP ceiling to the generator', () => {
      rs.mocked(openapiModule.parseOpenApiSecurity).mockReturnValue(
        partnerParsed as unknown as ReturnType<
          typeof openapiModule.parseOpenApiSecurity
        >,
      );

      generateKongConfig();

      expect(defaultLimitsModule.buildApiKeyDefaultLimits).toHaveBeenCalledWith(
        userConfig,
      );
      expect(configModule.resolveApiKeyIpLimit).toHaveBeenCalledWith(
        mockConfigNoAuth,
      );
      expect(
        kongSecurityModule.generateSecurityBasedServices,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          partnerApi: { defaultLimits: { minute: 100 }, ipLimitPerMinute: 120 },
        }),
      );
    });

    it('should read kong.user.yml before writing kong.tsdevstack.yml', () => {
      generateKongConfig();

      const readOrder = rs.mocked(fsModule.readYamlFile).mock
        .invocationCallOrder[0];
      const writeCall = rs
        .mocked(fsModule.writeYamlFile)
        .mock.calls.findIndex((call) =>
          (call[0] as string).endsWith('kong.tsdevstack.yml'),
        );
      const writeOrder = rs.mocked(fsModule.writeYamlFile).mock
        .invocationCallOrder[writeCall];
      expect(readOrder).toBeLessThan(writeOrder);
    });

    it('should not derive default limits without partner routes', () => {
      generateKongConfig();

      expect(
        defaultLimitsModule.buildApiKeyDefaultLimits,
      ).not.toHaveBeenCalled();
      expect(
        kongSecurityModule.generateSecurityBasedServices,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          partnerApi: { defaultLimits: {}, ipLimitPerMinute: 120 },
        }),
      );
    });

    it('should warn about static partner consumers in an existing kong.user.yml', () => {
      generateKongConfig();

      expect(
        warnConsumersModule.warnStaticPartnerConsumers,
      ).toHaveBeenCalledWith(userConfig, 'kong.user.yml');
    });

    it('should print an info line for @PartnerApi() routes without the auth template', () => {
      rs.mocked(openapiModule.parseOpenApiSecurity).mockReturnValue(
        partnerParsed as unknown as ReturnType<
          typeof openapiModule.parseOpenApiSecurity
        >,
      );

      generateKongConfig();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          '@PartnerApi() routes in user-service, but no auth template',
        ),
      );
    });

    it('should not print the info line with the auth template', () => {
      rs.mocked(configModule.loadFrameworkConfig).mockReturnValue(
        mockConfigWithAuth,
      );
      rs.mocked(configModule.hasAuthTemplate).mockReturnValue(true);
      rs.mocked(openapiModule.parseOpenApiSecurity).mockReturnValue(
        partnerParsed as unknown as ReturnType<
          typeof openapiModule.parseOpenApiSecurity
        >,
      );

      generateKongConfig();

      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('no auth template'),
      );
    });
  });
});
