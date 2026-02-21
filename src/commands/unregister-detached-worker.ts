/**
 * Unregister Detached Worker Command
 *
 * Removes a detached worker entry from framework config.
 * This command only updates framework config - it does NOT delete files or cloud resources.
 *
 * Usage:
 *   npx tsdevstack unregister-detached-worker
 *   npx tsdevstack unregister-detached-worker --worker auth-worker
 */

import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { loadFrameworkConfig, saveFrameworkConfig } from '../utils/config';
import { CliError } from '../utils/errors';

export interface UnregisterDetachedWorkerOptions {
  worker?: string;
}

/**
 * Unregister a detached worker from framework config
 */
export async function unregisterDetachedWorker(
  options: UnregisterDetachedWorkerOptions
): Promise<void> {
  logger.newline();
  logger.info('Unregister Detached Worker');
  logger.newline();

  const config = loadFrameworkConfig();

  // Get all workers from config
  const workers = config.services.filter((s) => s.type === 'worker');

  if (workers.length === 0) {
    throw new CliError(
      'No detached workers found in framework config',
      'unregister-detached-worker',
      'Register a worker first with: npx tsdevstack register-detached-worker'
    );
  }

  // Select worker to unregister
  let workerName = options.worker;
  if (!workerName) {
    const { selectedWorker } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedWorker',
        message: 'Select worker to unregister:',
        choices: workers.map((w) => ({
          name: `${w.name} (base: ${w.baseService})`,
          value: w.name,
        })),
      },
    ]);
    workerName = selectedWorker as string;
  }

  // Validate worker exists
  const worker = config.services.find(
    (s) => s.name === workerName && s.type === 'worker'
  );

  if (!worker) {
    const availableWorkers = workers.map((w) => w.name).join(', ');
    throw new CliError(
      `Worker "${workerName}" not found in framework config`,
      'unregister-detached-worker',
      availableWorkers
        ? `Available workers: ${availableWorkers}`
        : 'No workers configured'
    );
  }

  // Show warning about cloud resources
  logger.newline();
  logger.warn('IMPORTANT: This only removes the worker from framework config.');
  logger.warn('If the worker is deployed, remove it from cloud first:');
  logger.newline();
  logger.info(`  npx tsdevstack infra:remove-detached-worker --env <env> --worker ${workerName}`);
  logger.newline();

  // Confirmation
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `Unregister "${workerName}" from framework config?`,
      default: false,
    },
  ]);

  if (!confirmed) {
    logger.info('Aborted.');
    return;
  }

  // Remove worker from config
  const updatedServices = config.services.filter((s) => s.name !== workerName);
  const updatedConfig = { ...config, services: updatedServices };

  saveFrameworkConfig(updatedConfig);

  logger.newline();
  logger.success(`Unregistered worker: ${workerName}`);
  logger.newline();

  logger.info('Next steps:');
  logger.info('  1. Commit your changes');
  logger.info('  2. (Optional) Delete worker files if no longer needed:');
  logger.info(`     - apps/${worker.baseService}/src/worker.ts`);
  logger.info(`     - apps/${worker.baseService}/src/worker.module.ts`);
  logger.newline();
}