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
rs.mock('../utils/workers', { mock: true });

import inquirer from 'inquirer';
import fs from 'node:fs';
import { logger } from '../utils/logger';
import { loadFrameworkConfig, saveFrameworkConfig } from '../utils/config';
import { findProjectRoot } from '../utils/paths';
import { validateServiceName } from '../utils/validation/validate-service-name';
import { addWorkerScripts, scaffoldWorkerFiles } from '../utils/workers';
import { CliError } from '../utils/errors';
import { createMockFrameworkConfig } from '../test-fixtures/framework-config';
import { registerDetachedWorker } from './register-detached-worker';

describe('registerDetachedWorker', () => {
  beforeEach(() => {
    rs.resetAllMocks();
    rs.mocked(findProjectRoot).mockReturnValue('/project');
    rs.mocked(fs.existsSync).mockReturnValue(true);
    rs.mocked(scaffoldWorkerFiles).mockReturnValue({
      created: [
        'src/worker.ts',
        'src/worker.module.ts',
        'tsconfig.worker.json',
      ],
      kept: [],
    });
    rs.mocked(addWorkerScripts).mockReturnValue({
      added: ['start-worker:dev', 'start-worker'],
      kept: [],
    });
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
          type: 'select',
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

  describe('worker files and scripts', () => {
    beforeEach(() => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'offers-service', type: 'nestjs', port: 3001 }],
        }),
      );
    });

    it("should create the missing files and scripts in the base service's folder", async () => {
      await registerDetachedWorker({
        name: 'offers-worker',
        baseService: 'offers-service',
      });

      expect(scaffoldWorkerFiles).toHaveBeenCalledWith(
        '/project/apps/offers-service',
      );
      expect(addWorkerScripts).toHaveBeenCalledWith(
        '/project/apps/offers-service/package.json',
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Created in apps/offers-service:',
      );
      expect(logger.info).toHaveBeenCalledWith('  src/worker.module.ts');
      expect(logger.info).toHaveBeenCalledWith(
        '  package.json script "start-worker:dev"',
      );
    });

    it('should list what was already there and left alone', async () => {
      rs.mocked(scaffoldWorkerFiles).mockReturnValue({
        created: ['tsconfig.worker.json'],
        kept: ['src/worker.ts', 'src/worker.module.ts'],
      });
      rs.mocked(addWorkerScripts).mockReturnValue({
        added: [],
        kept: ['start-worker:dev', 'start-worker'],
      });

      await registerDetachedWorker({
        name: 'offers-worker',
        baseService: 'offers-service',
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Already in apps/offers-service, left as they are:',
      );
      expect(logger.info).toHaveBeenCalledWith('  src/worker.ts');
      expect(logger.info).toHaveBeenCalledWith(
        '  package.json script "start-worker"',
      );
    });

    it('should say nothing was created when everything was there', async () => {
      rs.mocked(scaffoldWorkerFiles).mockReturnValue({
        created: [],
        kept: ['src/worker.ts', 'src/worker.module.ts', 'tsconfig.worker.json'],
      });
      rs.mocked(addWorkerScripts).mockReturnValue({
        added: [],
        kept: ['start-worker:dev', 'start-worker'],
      });

      await registerDetachedWorker({
        name: 'offers-worker',
        baseService: 'offers-service',
      });

      expect(logger.info).not.toHaveBeenCalledWith(
        'Created in apps/offers-service:',
      );
    });

    it("should stop before changing anything when the base service's folder has no package.json", async () => {
      rs.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        registerDetachedWorker({
          name: 'offers-worker',
          baseService: 'offers-service',
        }),
      ).rejects.toThrow('apps/offers-service/package.json not found');
      expect(scaffoldWorkerFiles).not.toHaveBeenCalled();
      expect(saveFrameworkConfig).not.toHaveBeenCalled();
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

    it('should point to adding a processor, then committing and deploying', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
        }),
      );

      await registerDetachedWorker({
        name: 'auth-worker',
        baseService: 'auth-service',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '  1. Add a processor: register its queue in apps/auth-service/src/worker.module.ts and add the class to providers',
      );
      expect(logger.info).toHaveBeenCalledWith('  2. Commit your changes');
      expect(logger.info).toHaveBeenCalledWith(
        '  3. Deploy the service: npx tsdevstack infra:deploy-services --service auth-service',
      );
    });
  });
});
