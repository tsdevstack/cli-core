import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const {
  mockGenerateFrameworkServices,
  mockGenerateUserComposeTemplate,
  mockWritePgAdminConfigs,
  mockWriteMonitoringConfigs,
} = rs.hoisted(() => ({
  mockGenerateFrameworkServices: rs.fn(),
  mockGenerateUserComposeTemplate: rs.fn(),
  mockWritePgAdminConfigs: rs.fn(),
  mockWriteMonitoringConfigs: rs.fn(),
}));

const { mockLoadFrameworkConfig } = rs.hoisted(() => ({
  mockLoadFrameworkConfig: rs.fn(),
}));

const { mockLoadLocalSecrets } = rs.hoisted(() => ({
  mockLoadLocalSecrets: rs.fn(),
}));

const { mockWriteYamlFile } = rs.hoisted(() => ({
  mockWriteYamlFile: rs.fn(),
}));

const { mockFindProjectRoot } = rs.hoisted(() => ({
  mockFindProjectRoot: rs.fn(),
}));

rs.mock('../utils/docker/compose', () => ({
  generateFrameworkServices: mockGenerateFrameworkServices,
  generateUserComposeTemplate: mockGenerateUserComposeTemplate,
  writePgAdminConfigs: mockWritePgAdminConfigs,
  writeMonitoringConfigs: mockWriteMonitoringConfigs,
}));

rs.mock('../utils/config', () => ({
  loadFrameworkConfig: mockLoadFrameworkConfig,
}));

rs.mock('../utils/secrets', () => ({
  loadLocalSecrets: mockLoadLocalSecrets,
}));

rs.mock('../utils/fs', () => ({
  writeYamlFile: mockWriteYamlFile,
}));

rs.mock('../utils/paths/find-project-root', () => ({
  findProjectRoot: mockFindProjectRoot,
}));

rs.mock('../utils/logger', () => ({
  logger: {
    generating: rs.fn(),
    newline: rs.fn(),
    info: rs.fn(),
    loading: rs.fn(),
    checking: rs.fn(),
    complete: rs.fn(),
    summary: rs.fn(),
    warn: rs.fn(),
    running: rs.fn(),
  },
}));

import { generateDockerCompose } from './generate-docker-compose';
import { logger } from '../utils/logger';
import type { FrameworkConfig } from '../utils/config';

function makeConfig(overrides?: Partial<FrameworkConfig>): FrameworkConfig {
  return {
    project: { name: 'test-project', version: '1.0.0' },
    cloud: { provider: 'gcp' },
    services: [],
    ...overrides,
  };
}

describe('generateDockerCompose', () => {
  const mockRootDir = '/mock/project';
  const mockSecrets = { SOME_SECRET: 'value' };
  const mockFrameworkServices = { gateway: {}, redis: {} };

  beforeEach(() => {
    rs.clearAllMocks();
    mockFindProjectRoot.mockReturnValue(mockRootDir);
    mockLoadFrameworkConfig.mockReturnValue(makeConfig());
    mockLoadLocalSecrets.mockReturnValue(mockSecrets);
    mockGenerateFrameworkServices.mockReturnValue(mockFrameworkServices);
  });

  describe('Standard use cases', () => {
    it('should load framework config', () => {
      generateDockerCompose();

      expect(mockLoadFrameworkConfig).toHaveBeenCalledTimes(1);
    });

    it('should load local secrets with DB password extraction enabled', () => {
      generateDockerCompose();

      expect(mockLoadLocalSecrets).toHaveBeenCalledWith(true);
    });

    it('should generate framework services with config and secrets', () => {
      const config = makeConfig();
      mockLoadFrameworkConfig.mockReturnValue(config);

      generateDockerCompose();

      expect(mockGenerateFrameworkServices).toHaveBeenCalledWith(
        config,
        mockSecrets,
      );
    });

    it('should write docker-compose.yml with correct structure', () => {
      generateDockerCompose();

      expect(mockWriteYamlFile).toHaveBeenCalledWith(
        `${mockRootDir}/docker-compose.yml`,
        expect.objectContaining({
          name: 'test-project',
          services: mockFrameworkServices,
          networks: {
            'test-project-network': { driver: 'bridge' },
          },
          volumes: {
            db_data: null,
            redis_data: null,
          },
          include: [{ path: 'docker-compose.user.yml', required: false }],
        }),
      );
    });

    it('should write pgAdmin configs with root dir, services, and secrets', () => {
      const services = [
        { name: 'auth-service', type: 'nestjs', port: 3000, hasDatabase: true },
      ];
      const config = makeConfig({ services });
      mockLoadFrameworkConfig.mockReturnValue(config);

      generateDockerCompose();

      expect(mockWritePgAdminConfigs).toHaveBeenCalledWith(
        mockRootDir,
        services,
        mockSecrets,
      );
    });

    it('should write monitoring configs with root dir and config', () => {
      const config = makeConfig();
      mockLoadFrameworkConfig.mockReturnValue(config);

      generateDockerCompose();

      expect(mockWriteMonitoringConfigs).toHaveBeenCalledWith(
        mockRootDir,
        config,
      );
    });

    it('should generate user compose template with root dir and network name', () => {
      generateDockerCompose();

      expect(mockGenerateUserComposeTemplate).toHaveBeenCalledWith(
        mockRootDir,
        'test-project-network',
      );
    });

    it('should build network name from project name', () => {
      const config = makeConfig({
        project: { name: 'my-app', version: '1.0.0' },
      });
      mockLoadFrameworkConfig.mockReturnValue(config);

      generateDockerCompose();

      expect(mockWriteYamlFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          networks: {
            'my-app-network': { driver: 'bridge' },
          },
        }),
      );
    });
  });

  describe('Context handling', () => {
    it('should log remove context when context.operation is remove', () => {
      generateDockerCompose({
        operation: 'remove',
        removedService: 'old-service',
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Removing service: old-service'),
      );
    });

    it('should not log remove context when context.operation is not remove', () => {
      generateDockerCompose({ operation: 'add' });

      const infoCalls = rs.mocked(logger.info).mock.calls;
      const removeLogCalls = infoCalls.filter(
        (call) =>
          typeof call[0] === 'string' && call[0].includes('Removing service'),
      );
      expect(removeLogCalls).toHaveLength(0);
    });

    it('should work without context', () => {
      expect(() => generateDockerCompose()).not.toThrow();

      expect(mockLoadFrameworkConfig).toHaveBeenCalledTimes(1);
      expect(mockWriteYamlFile).toHaveBeenCalledTimes(1);
    });

    it('should work with undefined context', () => {
      expect(() => generateDockerCompose(undefined)).not.toThrow();

      expect(mockLoadFrameworkConfig).toHaveBeenCalledTimes(1);
      expect(mockWriteYamlFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('Logging', () => {
    it('should log generating message', () => {
      generateDockerCompose();

      expect(logger.generating).toHaveBeenCalledWith(
        'Generating docker-compose.yml...',
      );
    });

    it('should log loading messages for config and secrets', () => {
      generateDockerCompose();

      expect(logger.loading).toHaveBeenCalledWith(
        'Loading framework config...',
      );
      expect(logger.loading).toHaveBeenCalledWith('Loading secrets...');
    });

    it('should log completion message', () => {
      generateDockerCompose();

      expect(logger.complete).toHaveBeenCalledWith(
        'Generated docker-compose.yml successfully!',
      );
    });

    it('should log summary with database info when services have databases', () => {
      const services = [
        { name: 'auth-service', type: 'nestjs', port: 3000, hasDatabase: true },
        {
          name: 'offers-service',
          type: 'nestjs',
          port: 3001,
          hasDatabase: true,
        },
      ];
      const config = makeConfig({ services });
      mockLoadFrameworkConfig.mockReturnValue(config);

      generateDockerCompose();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('PostgreSQL databases (2)'),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('auth-db'),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('offers-db'),
      );
    });

    it('should not log database info when no services have databases', () => {
      const services = [
        { name: 'frontend', type: 'nextjs', port: 3000, hasDatabase: false },
      ];
      const config = makeConfig({ services });
      mockLoadFrameworkConfig.mockReturnValue(config);

      generateDockerCompose();

      const infoCalls = rs.mocked(logger.info).mock.calls;
      const dbLogCalls = infoCalls.filter(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('PostgreSQL databases'),
      );
      expect(dbLogCalls).toHaveLength(0);
    });

    it('should log database port from service databasePort when specified', () => {
      const services = [
        {
          name: 'auth-service',
          type: 'nestjs',
          port: 3000,
          hasDatabase: true,
          databasePort: 5433,
        },
      ];
      const config = makeConfig({ services });
      mockLoadFrameworkConfig.mockReturnValue(config);

      generateDockerCompose();

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('port 5433'),
      );
    });

    it('should log checking message for docker-compose.user.yml', () => {
      generateDockerCompose();

      expect(logger.checking).toHaveBeenCalledWith(
        'Checking docker-compose.user.yml...',
      );
    });
  });
});
