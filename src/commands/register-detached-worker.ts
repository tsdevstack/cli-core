/**
 * Register Detached Worker Command
 *
 * Registers a detached worker in the framework config. The worker will be deployed
 * as a separate Cloud Run container using the same Docker image as its
 * base service, but with a different entrypoint (dist/worker.js).
 *
 * This command only updates the framework config - it does NOT scaffold files.
 * User must manually create worker.ts, worker.module.ts, and processor files.
 *
 * Usage:
 *   npx tsdevstack register-detached-worker
 *   npx tsdevstack register-detached-worker --name auth-worker --base-service auth-service
 */

import path from 'node:path';
import fs from 'node:fs';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { loadFrameworkConfig, saveFrameworkConfig } from '../utils/config';
import { findProjectRoot } from '../utils/paths';
import { CliError } from '../utils/errors';
import { validateServiceName } from '../utils/validation/validate-service-name';

export interface RegisterDetachedWorkerOptions {
  name?: string;
  baseService?: string;
}

/**
 * Register a detached worker in framework config
 */
export async function registerDetachedWorker(
  options: RegisterDetachedWorkerOptions
): Promise<void> {
  logger.newline();
  logger.info('Register Detached Worker');
  logger.newline();

  const projectRoot = findProjectRoot();
  const config = loadFrameworkConfig();

  // Get NestJS services (only these can have workers)
  const nestjsServices = config.services.filter((s) => s.type === 'nestjs');

  if (nestjsServices.length === 0) {
    throw new CliError(
      'No NestJS services found in framework config',
      'register-detached-worker',
      'Add a NestJS service first with: npx tsdevstack add-service --type nestjs'
    );
  }

  // Step 1: Select base service
  let baseServiceName = options.baseService;
  if (!baseServiceName) {
    const { selectedService } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedService',
        message: 'Select base service for the worker:',
        choices: nestjsServices.map((s) => ({
          name: s.name,
          value: s.name,
        })),
      },
    ]);
    baseServiceName = selectedService as string;
  }

  // Validate base service exists and is NestJS
  const baseService = config.services.find((s) => s.name === baseServiceName);
  if (!baseService) {
    throw new CliError(
      `Service "${baseServiceName}" not found in framework config`,
      'register-detached-worker',
      `Available NestJS services: ${nestjsServices.map((s) => s.name).join(', ')}`
    );
  }

  if (baseService.type !== 'nestjs') {
    throw new CliError(
      `Service "${baseServiceName}" is not a NestJS service (type: ${baseService.type})`,
      'register-detached-worker',
      'Workers can only be attached to NestJS services'
    );
  }

  // Step 2: Get worker name
  let workerName = options.name;
  if (!workerName) {
    const defaultName = `${baseServiceName.replace(/-service$/, '')}-worker`;
    const { inputName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputName',
        message: 'Worker name:',
        default: defaultName,
        validate: (input: string) => {
          try {
            validateWorkerName(input, config.services.map((s) => s.name));
            return true;
          } catch (error) {
            return error instanceof Error ? error.message : 'Invalid worker name';
          }
        },
      },
    ]);
    workerName = inputName as string;
  } else {
    // Validate provided name
    validateWorkerName(workerName, config.services.map((s) => s.name));
  }

  // Check if worker already exists
  const existingWorker = config.services.find((s) => s.name === workerName);
  if (existingWorker) {
    throw new CliError(
      `"${workerName}" already exists in framework config`,
      'register-detached-worker',
      existingWorker.type === 'worker'
        ? 'This worker is already registered'
        : 'A service with this name already exists'
    );
  }

  // Check if worker.ts exists (optional warning)
  const workerFilePath = path.join(projectRoot, 'apps', baseServiceName, 'src', 'worker.ts');
  const workerExists = fs.existsSync(workerFilePath);

  if (!workerExists) {
    logger.newline();
    logger.warn('Note: worker.ts not found at:');
    logger.warn(`  apps/${baseServiceName}/src/worker.ts`);
    logger.newline();
    logger.info('You will need to create the following files:');
    logger.info(`  - apps/${baseServiceName}/src/worker.ts`);
    logger.info(`  - apps/${baseServiceName}/src/worker.module.ts`);
    logger.info('  - Processor files in src/processors/');
    logger.newline();
  }

  // Add worker to config
  const workerEntry = {
    name: workerName,
    type: 'worker',
    baseService: baseServiceName,
  };

  const updatedConfig = {
    ...config,
    services: [...config.services, workerEntry],
  };

  saveFrameworkConfig(updatedConfig);

  logger.newline();
  logger.success(`Registered detached worker: ${workerName}`);
  logger.newline();
  logger.info('Config entry added:');
  logger.info(JSON.stringify(workerEntry, null, 2));
  logger.newline();

  logger.info('Next steps:');
  if (!workerExists) {
    logger.info('  1. Create worker.ts and worker.module.ts (see Phase 20 docs)');
    logger.info('  2. Commit your changes');
    logger.info('  3. Deploy the service: npx tsdevstack infra:deploy-services --service ' + baseServiceName);
  } else {
    logger.info('  1. Commit your changes');
    logger.info('  2. Deploy the service: npx tsdevstack infra:deploy-services --service ' + baseServiceName);
  }
  logger.newline();
}

/**
 * Validate worker name
 */
function validateWorkerName(name: string, existingNames: string[]): void {
  // Use existing service name validation (handles kebab-case, length, etc.)
  validateServiceName(name);

  // Check if already exists
  if (existingNames.includes(name)) {
    throw new CliError(
      `"${name}" already exists in framework config`,
      'register-detached-worker'
    );
  }
}