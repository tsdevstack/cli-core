/**
 * Register Cron Command
 *
 * Adds a cron job to a NestJS service: a handler file
 * (src/cron/{name}.cron.ts) plus, the first time, the shared src/cron.ts,
 * src/cron.module.ts, tsconfig.cron.json and the `cron` script. Nothing
 * that exists is overwritten; the module lists the first handler, later
 * ones are two lines the command prints. It prints the infrastructure.json
 * entry and never writes that file, as for triggers.
 *
 * Usage:
 *   npx tsdevstack register-cron
 *   npx tsdevstack register-cron --service auth-service --name usage-report
 */

import path from 'node:path';
import fs from 'node:fs';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { loadFrameworkConfig } from '../utils/config';
import { findProjectRoot } from '../utils/paths';
import { CliError } from '../utils/errors';
import {
  addCronScript,
  assertCronJobNameFree,
  buildCronJobEntry,
  scaffoldCronFiles,
  validateCronJobName,
} from '../utils/cron';
import { APPS_DIR, CRON_MODULE_FILE } from '../constants';

export interface RegisterCronOptions {
  service?: string;
  name?: string;
}

/**
 * Add a cron job handler to a NestJS service
 */
export async function registerCron(
  options: RegisterCronOptions,
): Promise<void> {
  logger.newline();
  logger.info('Register Cron Job');
  logger.newline();

  const projectRoot = findProjectRoot();
  const config = loadFrameworkConfig();

  const nestjsServices = config.services.filter((s) => s.type === 'nestjs');
  if (nestjsServices.length === 0) {
    throw new CliError(
      'No NestJS services found in framework config',
      'register-cron',
      'Add a NestJS service first with: npx tsdevstack add-service --type nestjs',
    );
  }

  // Step 1: the service whose image runs the job
  let serviceName = options.service;
  if (!serviceName) {
    const { selectedService } = await inquirer.prompt([
      {
        type: 'select',
        name: 'selectedService',
        message: 'Select the service the cron job belongs to:',
        choices: nestjsServices.map((s) => ({ name: s.name, value: s.name })),
      },
    ]);
    serviceName = selectedService as string;
  }

  const service = config.services.find((s) => s.name === serviceName);
  if (!service) {
    throw new CliError(
      `Service "${serviceName}" not found in framework config`,
      'register-cron',
      `Available NestJS services: ${nestjsServices.map((s) => s.name).join(', ')}`,
    );
  }
  if (service.type !== 'nestjs') {
    throw new CliError(
      `Service "${serviceName}" is not a NestJS service (type: ${service.type})`,
      'register-cron',
      "Cron jobs run a NestJS service's image with a different command",
    );
  }

  // Step 2: the job's name
  let jobName = options.name;
  if (!jobName) {
    const { inputName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'inputName',
        message: 'Cron job name (kebab-case, e.g. usage-report):',
        validate: (input: string) => {
          try {
            validateCronJobName(input);
            return true;
          } catch (error) {
            return error instanceof Error
              ? error.message
              : 'Invalid cron job name';
          }
        },
      },
    ]);
    jobName = inputName as string;
  } else {
    validateCronJobName(jobName);
  }
  // Unique across the project, both kinds: the name becomes cloud resource names
  assertCronJobNameFree(projectRoot, serviceName, jobName, config.services);

  // Step 3: the files and the script, in the service's folder
  const serviceDir = path.join(projectRoot, APPS_DIR, serviceName);
  const packageJsonPath = path.join(serviceDir, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new CliError(
      `${APPS_DIR}/${serviceName}/package.json not found`,
      'register-cron',
      `The cron job's files go in its service's folder, ${APPS_DIR}/${serviceName}`,
    );
  }
  const files = scaffoldCronFiles(serviceDir, serviceName, jobName);
  const scripts = addCronScript(packageJsonPath);
  const handlerCreated = files.created.includes(files.handlerFile);

  logger.newline();
  if (handlerCreated) {
    logger.success(`Registered cron job: ${jobName} (${serviceName})`);
  } else {
    logger.warn(
      `Cron job "${jobName}" already has a handler in ${APPS_DIR}/${serviceName}; nothing was overwritten`,
    );
  }
  logger.newline();

  const created = [
    ...files.created,
    ...scripts.added.map((name) => `package.json script "${name}"`),
  ];
  const kept = [
    ...files.kept,
    ...scripts.kept.map((name) => `package.json script "${name}"`),
  ];
  if (created.length > 0) {
    logger.info(`Created in ${APPS_DIR}/${serviceName}:`);
    for (const item of created) {
      logger.info(`  ${item}`);
    }
    logger.newline();
  }
  if (kept.length > 0) {
    logger.info(`Already in ${APPS_DIR}/${serviceName}, left as they are:`);
    for (const item of kept) {
      logger.info(`  ${item}`);
    }
    logger.newline();
  }

  // The module lists the first handler; a later one is the user's two lines
  const linesToAdd = handlerCreated && !files.moduleCreated;
  if (linesToAdd) {
    logger.info(
      `Add the handler to ${APPS_DIR}/${serviceName}/${CRON_MODULE_FILE}:`,
    );
    logger.info(
      `  import { ${files.className} } from './cron/${jobName}.cron';`,
    );
    logger.info(`  ${files.className},   (in the handlers list)`);
    logger.newline();
  }

  const entry = buildCronJobEntry(jobName, serviceName);
  logger.info(
    'Add this to "scheduledJobs" in .tsdevstack/infrastructure.json, for each environment that should run it:',
  );
  logger.info(JSON.stringify(entry, null, 2));
  logger.info(
    '  schedule: cron syntax, UTC unless "timezone" is set; timeout: seconds, the run is stopped after it',
  );
  logger.info(
    '  optional: "cpu" and "memory" (the migration job\'s values when left out)',
  );
  logger.newline();

  const steps = [
    `Write the job in ${APPS_DIR}/${serviceName}/${files.handlerFile}: the run() method`,
    ...(linesToAdd ? [`Add the two lines above to ${CRON_MODULE_FILE}`] : []),
    `Try it locally: npx tsdevstack run-cron ${jobName} --service ${serviceName}`,
    'Add the entry to infrastructure.json, then: npx tsdevstack infra:generate --env <env>',
  ];
  logger.info('Next steps:');
  steps.forEach((step, index) => {
    logger.info(`  ${index + 1}. ${step}`);
  });
  logger.newline();
}
