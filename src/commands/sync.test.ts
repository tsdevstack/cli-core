import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import * as generateSecretsModule from './generate-secrets-local';
import * as generateDockerComposeModule from './generate-docker-compose';
import * as generateKongConfigModule from './generate-kong-config';
import * as dockerModule from '../utils/docker';
import * as configModule from '../utils/config';
import * as loggerModule from '../utils/logger';
import * as prismaModule from '../utils/prisma';
import * as findProjectRootModule from '../utils/paths/find-project-root';
import { sync } from './sync';
import type { FrameworkConfig } from '../utils/config';

rs.mock('./generate-secrets-local', { mock: true });
rs.mock('./generate-docker-compose', { mock: true });
rs.mock('./generate-kong-config', { mock: true });
rs.mock('../utils/docker', { mock: true });
rs.mock('../utils/config', { mock: true });
rs.mock('../utils/logger', { mock: true });
rs.mock('../utils/prisma', { mock: true });
rs.mock('../utils/paths/find-project-root', { mock: true });

describe('sync', () => {
  const mockLogger = {
    syncing: rs.fn(),
    loading: rs.fn(),
    updating: rs.fn(),
    generating: rs.fn(),
    running: rs.fn(),
    success: rs.fn(),
    info: rs.fn(),
    warn: rs.fn(),
    complete: rs.fn(),
    summary: rs.fn(),
    newline: rs.fn(),
  };

  const mockConfig: FrameworkConfig = {
    project: { name: 'test-project', version: '1.0.0' },
    cloud: { provider: null },
    services: [
      { name: 'auth-service', type: 'nestjs', port: 3001, hasDatabase: true },
      { name: 'user-service', type: 'nestjs', port: 3002, hasDatabase: true },
      { name: 'frontend', type: 'nextjs', port: 3000, hasDatabase: false },
    ],
  };

  beforeEach(() => {
    rs.clearAllMocks();

    rs.mocked(loggerModule.logger).syncing = mockLogger.syncing;
    rs.mocked(loggerModule.logger).loading = mockLogger.loading;
    rs.mocked(loggerModule.logger).updating = mockLogger.updating;
    rs.mocked(loggerModule.logger).generating = mockLogger.generating;
    rs.mocked(loggerModule.logger).running = mockLogger.running;
    rs.mocked(loggerModule.logger).success = mockLogger.success;
    rs.mocked(loggerModule.logger).info = mockLogger.info;
    rs.mocked(loggerModule.logger).warn = mockLogger.warn;
    rs.mocked(loggerModule.logger).complete = mockLogger.complete;
    rs.mocked(loggerModule.logger).summary = mockLogger.summary;
    rs.mocked(loggerModule.logger).newline = mockLogger.newline;

    rs.mocked(findProjectRootModule.findProjectRoot).mockReturnValue(
      '/mock/project',
    );
    rs.mocked(configModule.loadFrameworkConfig).mockReturnValue(mockConfig);
    rs.mocked(dockerModule.getDbServiceName).mockImplementation(
      (name: string) => `${name.replace(/-service$/, '')}-db`,
    );
    rs.mocked(prismaModule.hasPrismaSchema).mockReturnValue(true);
    rs.mocked(prismaModule.getDatabaseUrl).mockReturnValue(
      'postgresql://localhost:5432/db',
    );
  });

  describe('Sub-command orchestration', () => {
    it('should call generateSecretsLocal', () => {
      sync();
      expect(generateSecretsModule.generateSecretsLocal).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should call generateDockerCompose', () => {
      sync();
      expect(
        generateDockerComposeModule.generateDockerCompose,
      ).toHaveBeenCalledTimes(1);
    });

    it('should call generateKongConfig', () => {
      sync();
      expect(generateKongConfigModule.generateKongConfig).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should pass context to all sub-commands', () => {
      const context = {
        operation: 'remove' as const,
        removedService: 'auth-service',
      };
      sync(context);

      expect(generateSecretsModule.generateSecretsLocal).toHaveBeenCalledWith(
        context,
      );
      expect(
        generateDockerComposeModule.generateDockerCompose,
      ).toHaveBeenCalledWith(context);
      expect(generateKongConfigModule.generateKongConfig).toHaveBeenCalledWith(
        context,
      );
    });

    it('should pass undefined context when not provided', () => {
      sync();

      expect(generateSecretsModule.generateSecretsLocal).toHaveBeenCalledWith(
        undefined,
      );
      expect(
        generateDockerComposeModule.generateDockerCompose,
      ).toHaveBeenCalledWith(undefined);
      expect(generateKongConfigModule.generateKongConfig).toHaveBeenCalledWith(
        undefined,
      );
    });
  });

  describe('Critical infrastructure', () => {
    it('should build critical services list with redis and db services', () => {
      sync();

      expect(dockerModule.recreateContainers).toHaveBeenCalledWith(
        ['redis', 'auth-db', 'user-db'],
        '/mock/project',
        true,
      );
    });

    it('should only include redis when no services have databases', () => {
      const configNoDbs: FrameworkConfig = {
        ...mockConfig,
        services: [
          { name: 'frontend', type: 'nextjs', port: 3000, hasDatabase: false },
        ],
      };
      rs.mocked(configModule.loadFrameworkConfig).mockReturnValue(configNoDbs);

      sync();

      expect(dockerModule.recreateContainers).toHaveBeenCalledWith(
        ['redis'],
        '/mock/project',
        true,
      );
    });
  });

  describe('Container management', () => {
    it('should start remaining containers with detach and no wait', () => {
      sync();

      expect(dockerModule.composeUp).toHaveBeenCalledWith(
        '/mock/project',
        true,
        false,
      );
    });

    it('should recreate pgAdmin without waiting', () => {
      sync();

      // Third call to recreateContainers is pgAdmin
      const calls = rs.mocked(dockerModule.recreateContainers).mock.calls;
      expect(calls[1]).toEqual([['pgadmin'], '/mock/project', false]);
    });
  });

  describe('Prisma migrations', () => {
    it('should run migrations for services with hasDatabase and prisma schema', () => {
      sync();

      expect(prismaModule.deployPrismaMigration).toHaveBeenCalledWith(
        'auth-service',
        'postgresql://localhost:5432/db',
      );
      expect(prismaModule.deployPrismaMigration).toHaveBeenCalledWith(
        'user-service',
        'postgresql://localhost:5432/db',
      );
    });

    it('should generate prisma client for each service', () => {
      sync();

      expect(prismaModule.generatePrismaClient).toHaveBeenCalledWith(
        'auth-service',
        'postgresql://localhost:5432/db',
      );
      expect(prismaModule.generatePrismaClient).toHaveBeenCalledWith(
        'user-service',
        'postgresql://localhost:5432/db',
      );
    });

    it('should skip services without prisma schema', () => {
      rs.mocked(prismaModule.hasPrismaSchema).mockImplementation(
        (name: string) => name === 'auth-service',
      );

      sync();

      expect(prismaModule.deployPrismaMigration).toHaveBeenCalledTimes(1);
      expect(prismaModule.deployPrismaMigration).toHaveBeenCalledWith(
        'auth-service',
        'postgresql://localhost:5432/db',
      );
    });

    it('should skip services without DATABASE_URL', () => {
      rs.mocked(prismaModule.getDatabaseUrl).mockImplementation(
        (name: string) =>
          name === 'auth-service' ? 'postgresql://localhost:5432/db' : null,
      );

      sync();

      expect(prismaModule.deployPrismaMigration).toHaveBeenCalledTimes(1);
    });

    it('should not run prisma for services without hasDatabase', () => {
      sync();

      // frontend has hasDatabase: false, should not be checked
      expect(prismaModule.hasPrismaSchema).not.toHaveBeenCalledWith('frontend');
    });

    it('should log when no services with prisma schemas found', () => {
      rs.mocked(prismaModule.hasPrismaSchema).mockReturnValue(false);

      sync();

      expect(mockLogger.info).toHaveBeenCalledWith(
        '   No services with Prisma schemas found',
      );
    });
  });

  describe('Completion', () => {
    it('should call printInfrastructureUrls at end', () => {
      sync();

      expect(loggerModule.printInfrastructureUrls).toHaveBeenCalledTimes(1);
    });

    it('should log sync completed', () => {
      sync();

      expect(mockLogger.complete).toHaveBeenCalledWith(
        'Sync completed successfully!',
      );
    });
  });
});
