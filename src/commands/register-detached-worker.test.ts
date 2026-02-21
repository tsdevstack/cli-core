/**
 * Tests for registerDetachedWorker command
 */

import { describe, it, expect, rs, beforeEach } from '@rstest/core';

// Mock dependencies (do NOT mock errors - we need real CliError for instanceof checks)
rs.mock('inquirer', { mock: true });
rs.mock('node:fs', { mock: true });
rs.mock('../utils/logger', { mock: true });
rs.mock('../utils/config', { mock: true });
rs.mock('../utils/paths', { mock: true });
rs.mock('../utils/validation/validate-service-name', { mock: true });

import inquirer from 'inquirer';
import fs from 'node:fs';
import { logger } from '../utils/logger';
import { loadFrameworkConfig, saveFrameworkConfig } from '../utils/config';
import { findProjectRoot } from '../utils/paths';
import { validateServiceName } from '../utils/validation/validate-service-name';
import { CliError } from '../utils/errors';
import { createMockFrameworkConfig } from '../test-fixtures/framework-config';
import { registerDetachedWorker } from './register-detached-worker';

describe('registerDetachedWorker', () => {
  beforeEach(() => {
    rs.resetAllMocks();
    rs.mocked(findProjectRoot).mockReturnValue('/project');
  });

  describe('when no NestJS services exist', () => {
    it('should throw CliError', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({ services: [] }),
      );

      await expect(registerDetachedWorker({})).rejects.toThrow(CliError);
      await expect(registerDetachedWorker({})).rejects.toThrow(
        'No NestJS services found in framework config',
      );
    });

    it('should throw CliError when only non-NestJS services exist', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'frontend', type: 'nextjs', port: 4000 }],
        }),
      );

      await expect(registerDetachedWorker({})).rejects.toThrow(
        'No NestJS services found in framework config',
      );
    });
  });

  describe('base service selection', () => {
    it('should prompt for base service when not provided', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [
            { name: 'auth-service', type: 'nestjs', port: 3000 },
            { name: 'offers-service', type: 'nestjs', port: 3001 },
          ],
        }),
      );

      rs.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ selectedService: 'auth-service' })
        .mockResolvedValueOnce({ inputName: 'auth-worker' });

      rs.mocked(fs.existsSync).mockReturnValue(true);

      await registerDetachedWorker({});

      expect(inquirer.prompt).toHaveBeenCalledWith([
        expect.objectContaining({
          type: 'list',
          name: 'selectedService',
          message: 'Select base service for the worker:',
          choices: [
            { name: 'auth-service', value: 'auth-service' },
            { name: 'offers-service', value: 'offers-service' },
          ],
        }),
      ]);
    });

    it('should use provided base service name without prompting', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
        }),
      );

      rs.mocked(fs.existsSync).mockReturnValue(true);

      await registerDetachedWorker({
        name: 'auth-worker',
        baseService: 'auth-service',
      });

      // First prompt (service selection) should not have been called
      // Only verifying that saveFrameworkConfig was called (meaning it succeeded)
      expect(saveFrameworkConfig).toHaveBeenCalled();
    });

    it('should throw when base service is not found in config', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
        }),
      );

      await expect(
        registerDetachedWorker({
          name: 'foo-worker',
          baseService: 'missing-service',
        }),
      ).rejects.toThrow(
        'Service "missing-service" not found in framework config',
      );
    });

    it('should throw when base service is not a NestJS type', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [
            { name: 'auth-service', type: 'nestjs', port: 3000 },
            { name: 'frontend', type: 'nextjs', port: 4000 },
          ],
        }),
      );

      await expect(
        registerDetachedWorker({
          name: 'front-worker',
          baseService: 'frontend',
        }),
      ).rejects.toThrow(
        'Service "frontend" is not a NestJS service (type: nextjs)',
      );
    });
  });

  describe('worker name', () => {
    it('should prompt for worker name when not provided with default derived from base service', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
        }),
      );

      rs.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ selectedService: 'auth-service' })
        .mockResolvedValueOnce({ inputName: 'auth-worker' });

      rs.mocked(fs.existsSync).mockReturnValue(true);

      await registerDetachedWorker({});

      // Second prompt should be for worker name
      expect(inquirer.prompt).toHaveBeenCalledTimes(2);
      const secondCallArgs = rs.mocked(inquirer.prompt).mock
        .calls[1]![0] as unknown[];
      expect(secondCallArgs[0]).toMatchObject({
        type: 'input',
        name: 'inputName',
        message: 'Worker name:',
        default: 'auth-worker',
      });
    });

    it('should derive default worker name by removing -service suffix', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'offers-service', type: 'nestjs', port: 3001 }],
        }),
      );

      rs.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ selectedService: 'offers-service' })
        .mockResolvedValueOnce({ inputName: 'offers-worker' });

      rs.mocked(fs.existsSync).mockReturnValue(true);

      await registerDetachedWorker({});

      const secondCallArgs = rs.mocked(inquirer.prompt).mock
        .calls[1]![0] as unknown[];
      expect(secondCallArgs[0]).toMatchObject({
        default: 'offers-worker',
      });
    });

    it('should use provided worker name without prompting for name', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
        }),
      );

      rs.mocked(fs.existsSync).mockReturnValue(true);

      await registerDetachedWorker({
        name: 'auth-worker',
        baseService: 'auth-service',
      });

      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('should validate provided worker name via validateServiceName', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
        }),
      );

      rs.mocked(fs.existsSync).mockReturnValue(true);

      await registerDetachedWorker({
        name: 'auth-worker',
        baseService: 'auth-service',
      });

      expect(validateServiceName).toHaveBeenCalledWith('auth-worker');
    });

    it('should throw when validateServiceName rejects the provided name', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
        }),
      );

      rs.mocked(validateServiceName).mockImplementation(() => {
        throw new CliError('Invalid name', 'validate-service-name');
      });

      await expect(
        registerDetachedWorker({
          name: 'INVALID',
          baseService: 'auth-service',
        }),
      ).rejects.toThrow('Invalid name');
    });
  });

  describe('duplicate worker detection', () => {
    it('should throw when worker name already exists as a worker', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [
            { name: 'auth-service', type: 'nestjs', port: 3000 },
            {
              name: 'auth-worker',
              type: 'worker' as 'nestjs',
              baseService: 'auth-service',
            },
          ],
        }),
      );

      await expect(
        registerDetachedWorker({
          name: 'auth-worker',
          baseService: 'auth-service',
        }),
      ).rejects.toThrow('"auth-worker" already exists in framework config');
    });

    it('should throw when worker name conflicts with an existing service', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [
            { name: 'auth-service', type: 'nestjs', port: 3000 },
            { name: 'bff-service', type: 'nestjs', port: 3001 },
          ],
        }),
      );

      await expect(
        registerDetachedWorker({
          name: 'bff-service',
          baseService: 'auth-service',
        }),
      ).rejects.toThrow('"bff-service" already exists in framework config');
    });
  });

  describe('worker.ts file check', () => {
    it('should warn when worker.ts does not exist', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
        }),
      );

      rs.mocked(fs.existsSync).mockReturnValue(false);

      await registerDetachedWorker({
        name: 'auth-worker',
        baseService: 'auth-service',
      });

      expect(fs.existsSync).toHaveBeenCalledWith(
        '/project/apps/auth-service/src/worker.ts',
      );
      expect(logger.warn).toHaveBeenCalledWith('Note: worker.ts not found at:');
      expect(logger.warn).toHaveBeenCalledWith(
        '  apps/auth-service/src/worker.ts',
      );
    });

    it('should not warn when worker.ts exists', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
        }),
      );

      rs.mocked(fs.existsSync).mockReturnValue(true);

      await registerDetachedWorker({
        name: 'auth-worker',
        baseService: 'auth-service',
      });

      expect(logger.warn).not.toHaveBeenCalledWith(
        'Note: worker.ts not found at:',
      );
    });
  });

  describe('config update', () => {
    it('should add worker entry to config with correct shape', async () => {
      const existingConfig = createMockFrameworkConfig({
        services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
      });

      rs.mocked(loadFrameworkConfig).mockReturnValue(existingConfig);
      rs.mocked(fs.existsSync).mockReturnValue(true);

      await registerDetachedWorker({
        name: 'auth-worker',
        baseService: 'auth-service',
      });

      expect(saveFrameworkConfig).toHaveBeenCalledWith({
        ...existingConfig,
        services: [
          ...existingConfig.services,
          {
            name: 'auth-worker',
            type: 'worker',
            baseService: 'auth-service',
          },
        ],
      });
    });

    it('should preserve existing services when adding worker', async () => {
      const existingConfig = createMockFrameworkConfig({
        services: [
          { name: 'auth-service', type: 'nestjs', port: 3000 },
          { name: 'offers-service', type: 'nestjs', port: 3001 },
        ],
      });

      rs.mocked(loadFrameworkConfig).mockReturnValue(existingConfig);
      rs.mocked(fs.existsSync).mockReturnValue(true);

      await registerDetachedWorker({
        name: 'auth-worker',
        baseService: 'auth-service',
      });

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0]![0];
      expect(savedConfig.services).toHaveLength(3);
      expect(savedConfig.services[0]).toEqual({
        name: 'auth-service',
        type: 'nestjs',
        port: 3000,
      });
      expect(savedConfig.services[1]).toEqual({
        name: 'offers-service',
        type: 'nestjs',
        port: 3001,
      });
      expect(savedConfig.services[2]).toEqual({
        name: 'auth-worker',
        type: 'worker',
        baseService: 'auth-service',
      });
    });
  });

  describe('success logging', () => {
    it('should log success message with worker name', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
        }),
      );

      rs.mocked(fs.existsSync).mockReturnValue(true);

      await registerDetachedWorker({
        name: 'auth-worker',
        baseService: 'auth-service',
      });

      expect(logger.success).toHaveBeenCalledWith(
        'Registered detached worker: auth-worker',
      );
    });

    it('should log config entry as JSON', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
        }),
      );

      rs.mocked(fs.existsSync).mockReturnValue(true);

      await registerDetachedWorker({
        name: 'auth-worker',
        baseService: 'auth-service',
      });

      expect(logger.info).toHaveBeenCalledWith(
        JSON.stringify(
          { name: 'auth-worker', type: 'worker', baseService: 'auth-service' },
          null,
          2,
        ),
      );
    });

    it('should show different next steps when worker.ts exists', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
        }),
      );

      rs.mocked(fs.existsSync).mockReturnValue(true);

      await registerDetachedWorker({
        name: 'auth-worker',
        baseService: 'auth-service',
      });

      // When worker.ts exists, step 1 is "Commit your changes" (no create step)
      expect(logger.info).toHaveBeenCalledWith('  1. Commit your changes');
    });

    it('should show create step in next steps when worker.ts does not exist', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
        }),
      );

      rs.mocked(fs.existsSync).mockReturnValue(false);

      await registerDetachedWorker({
        name: 'auth-worker',
        baseService: 'auth-service',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '  1. Create worker.ts and worker.module.ts (see Phase 20 docs)',
      );
    });
  });
});
