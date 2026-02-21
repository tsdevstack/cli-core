/**
 * Remove Service Command (Local Only)
 *
 * Removes a service from the local project:
 * - Deletes apps/{service-name}/ directory
 * - Deletes packages/{service-name}-client/ if exists
 * - Removes from config.json
 * - Removes from infrastructure.json
 * - Runs sync to regenerate docker-compose, kong, etc.
 *
 * Usage:
 *   npx tsdevstack remove-service order-service
 *   npx tsdevstack remove-service order-service --dry-run
 */

import path from 'node:path';
import fs from 'node:fs';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { loadFrameworkConfig, saveFrameworkConfig } from '../utils/config';
import { findProjectRoot } from '../utils/paths';
import { CliError } from '../utils/errors';
import { sync } from './sync';

export interface RemoveServiceOptions {
  dryRun?: boolean;
}

/**
 * Remove a service from the local project
 */
export async function removeService(
  serviceName: string | undefined,
  options: RemoveServiceOptions,
): Promise<void> {
  logger.newline();
  logger.warn('Remove Service (Local)');
  logger.newline();

  const projectRoot = findProjectRoot();
  const config = loadFrameworkConfig();

  // Resolve service name
  let resolvedServiceName: string;
  if (serviceName) {
    resolvedServiceName = serviceName;
  } else {
    if (config.services.length === 0) {
      throw new CliError(
        'No services found in config.json',
        'remove-service',
        'Add a service first with: npx tsdevstack add-service',
      );
    }

    // Filter out coupled workers — they are auto-removed with their base service
    const selectableServices = config.services.filter(
      (s) => !(s.type === 'worker' && s.baseService),
    );

    if (selectableServices.length === 0) {
      throw new CliError(
        'No removable services found in config.json',
        'remove-service',
        'Only coupled workers remain. Remove them by name: npx tsdevstack remove-service <worker-name>',
      );
    }

    const { selectedService } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedService',
        message: 'Select service to remove:',
        choices: selectableServices.map((s) => ({
          name: `${s.name} (${s.type})`,
          value: s.name,
        })),
      },
    ]);
    resolvedServiceName = selectedService as string;
  }

  // Validate service exists
  const service = config.services.find((s) => s.name === resolvedServiceName);
  if (!service) {
    const allServices = config.services.map((s) => s.name).join(', ');
    throw new CliError(
      `Service "${resolvedServiceName}" not found in config.json`,
      'remove-service',
      allServices
        ? `Available services: ${allServices}`
        : 'No services configured',
    );
  }

  // Find coupled workers (workers whose baseService matches the service being removed)
  const coupledWorkers = config.services.filter(
    (s) => s.type === 'worker' && s.baseService === resolvedServiceName,
  );

  // Build list of paths to delete (service + coupled workers)
  const pathsToDelete: { path: string; exists: boolean; type: string }[] = [];

  const appDir = path.join(projectRoot, 'apps', resolvedServiceName);
  pathsToDelete.push({
    path: appDir,
    exists: fs.existsSync(appDir),
    type: 'Service directory',
  });

  const clientDir = path.join(
    projectRoot,
    'packages',
    `${resolvedServiceName}-client`,
  );
  pathsToDelete.push({
    path: clientDir,
    exists: fs.existsSync(clientDir),
    type: 'Client package',
  });

  for (const worker of coupledWorkers) {
    const workerDir = path.join(projectRoot, 'apps', worker.name);
    pathsToDelete.push({
      path: workerDir,
      exists: fs.existsSync(workerDir),
      type: `Coupled worker directory (${worker.name})`,
    });
  }

  // Show warning about cloud resources
  const cmdLine = `npx tsdevstack infra:remove-service ${resolvedServiceName} --env <env>`;
  const boxWidth = 67; // inner width between ║ characters
  const paddedCmd = `  ${cmdLine}`.padEnd(boxWidth);

  logger.newline();
  logger.info(
    '╔═════════════════════════════════════════════════════════════════════╗',
  );
  logger.info(
    '║  IMPORTANT: Remove cloud resources BEFORE removing locally!        ║',
  );
  logger.info(
    '║                                                                     ║',
  );
  logger.info(
    '║  Run this for EACH environment where the service is deployed:      ║',
  );
  logger.info(`║${paddedCmd}║`);
  logger.info(
    '║                                                                     ║',
  );
  logger.info(
    '║  If you remove locally first, cloud resources will be orphaned.    ║',
  );
  logger.info(
    '╚═════════════════════════════════════════════════════════════════════╝',
  );
  logger.newline();

  // Show what will be deleted
  logger.info(`Service: ${service.name} (${service.type})`);
  logger.newline();
  logger.info('The following will be removed:');
  logger.newline();

  for (const item of pathsToDelete) {
    if (item.exists) {
      logger.validating(
        `  ${item.type}: ${path.relative(projectRoot, item.path)}`,
      );
    } else {
      logger.info(`  - ${item.type}: (not found)`);
    }
  }

  logger.validating('  Entry in .tsdevstack/config.json');
  if (coupledWorkers.length > 0) {
    for (const worker of coupledWorkers) {
      logger.validating(`  Coupled worker "${worker.name}" from config.json`);
    }
  }
  logger.validating('  Overrides in .tsdevstack/infrastructure.json (if any)');
  logger.newline();

  // Dry run mode
  if (options.dryRun) {
    logger.info('Dry run complete. No files were deleted.');
    return;
  }

  // Confirmation
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `Remove "${resolvedServiceName}" from local project?`,
      default: false,
    },
  ]);

  if (!confirmed) {
    logger.info('Aborted.');
    return;
  }

  // Delete directories
  logger.newline();
  logger.info('Removing files...');

  for (const item of pathsToDelete) {
    if (item.exists) {
      fs.rmSync(item.path, { recursive: true, force: true });
      logger.success(`  Deleted ${item.type}`);
    }
  }

  // Remove service and coupled workers from config.json
  const namesToRemove = new Set([
    resolvedServiceName,
    ...coupledWorkers.map((w) => w.name),
  ]);
  const updatedServices = config.services.filter(
    (s) => !namesToRemove.has(s.name),
  );
  const updatedConfig = { ...config, services: updatedServices };
  saveFrameworkConfig(updatedConfig);
  logger.success('  Removed from config.json');
  if (coupledWorkers.length > 0) {
    logger.success(
      `  Removed ${coupledWorkers.length} coupled worker(s) from config.json`,
    );
  }

  // Remove from infrastructure.json if it exists
  const infraConfigPath = path.join(
    projectRoot,
    '.tsdevstack',
    'infrastructure.json',
  );
  if (fs.existsSync(infraConfigPath)) {
    try {
      const infraContent = fs.readFileSync(infraConfigPath, 'utf-8');
      const infraConfig = JSON.parse(infraContent) as Record<string, unknown>;

      let modified = false;
      for (const env of Object.keys(infraConfig)) {
        if (env === 'version') continue;
        const envConfig = infraConfig[env] as
          | Record<string, unknown>
          | undefined;
        for (const name of namesToRemove) {
          if (envConfig && name in envConfig) {
            delete envConfig[name];
            modified = true;
          }
        }
      }

      if (modified) {
        fs.writeFileSync(
          infraConfigPath,
          JSON.stringify(infraConfig, null, 2) + '\n',
        );
        logger.success('  Removed from infrastructure.json');
      }
    } catch {
      logger.warn('  Could not update infrastructure.json');
    }
  }

  // Run sync
  logger.newline();
  logger.info('Running sync to regenerate infrastructure files...');
  logger.newline();

  try {
    sync();
  } catch (error) {
    logger.warn(
      `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    logger.info('You may need to run "npx tsdevstack sync" manually.');
  }

  // Success message
  logger.newline();
  logger.success(`Service "${resolvedServiceName}" removed from local project`);
  logger.newline();

  // Reminder about Kong redeploy
  logger.info('Next steps:');
  logger.info('  1. Commit your changes');
  logger.info('  2. Rebuild and redeploy Kong to each environment:');
  logger.info('     npx tsdevstack infra:generate-kong --env <env>');
  logger.info('     npx tsdevstack infra:build-kong --env <env>');
  logger.info('     npx tsdevstack infra:deploy-kong --env <env>');
  logger.newline();
}
