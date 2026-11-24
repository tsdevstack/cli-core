/**
 * Run Cron Command
 *
 * Runs a scheduled job once, locally, against the running compose stack.
 * A cron job (a handler file in a service) runs through the service's
 * `cron` script, `npm run cron -- <name>`, and this command exits with the
 * run's exit code. A trigger (an entry with an endpoint in
 * infrastructure.json) is called on its service's local port; the
 * SchedulerGuard lets local calls through.
 *
 * Usage:
 *   npx tsdevstack run-cron usage-report --service auth-service
 *   npx tsdevstack run-cron cleanup-tokens            (a trigger; --env to pick the environment's entry)
 */

import path from 'node:path';
import fs from 'node:fs';
import { logger } from '../utils/logger';
import { loadFrameworkConfig } from '../utils/config';
import { findProjectRoot } from '../utils/paths';
import { CliError } from '../utils/errors';
import {
  callTriggerLocally,
  findCronHandlerServices,
  findScheduledJobEntries,
  runCronJobLocally,
} from '../utils/cron';
import {
  APPS_DIR,
  CRON_HANDLER_DIR,
  CRON_HANDLER_SUFFIX,
  CRON_JOB_TYPE,
} from '../constants';

export interface RunCronOptions {
  service?: string;
  env?: string;
}

/**
 * Run a scheduled job once locally: a cron job handler, or a trigger's endpoint
 */
export async function runCron(
  jobName: string,
  options: RunCronOptions,
): Promise<void> {
  const projectRoot = findProjectRoot();
  const config = loadFrameworkConfig();

  // A cron job: the handler file names the service
  let serviceName = options.service;
  if (serviceName) {
    const service = config.services.find((s) => s.name === serviceName);
    if (!service) {
      throw new CliError(
        `Service "${serviceName}" not found in framework config`,
        'run-cron',
        `Services: ${config.services.map((s) => s.name).join(', ')}`,
      );
    }
  } else {
    const candidates = findCronHandlerServices(
      projectRoot,
      jobName,
      config.services,
    );
    if (candidates.length > 1) {
      throw new CliError(
        `Several services have a cron job named "${jobName}": ${candidates.join(', ')}`,
        'run-cron',
        'Scheduled job names are unique across the project: rename all but one, then say which one to run with --service',
      );
    }
    serviceName = candidates[0];
  }

  const handlerFile = `${CRON_HANDLER_DIR}/${jobName}${CRON_HANDLER_SUFFIX}`;
  if (
    serviceName &&
    fs.existsSync(path.join(projectRoot, APPS_DIR, serviceName, handlerFile))
  ) {
    runCronJobLocally(projectRoot, serviceName, jobName);
    return;
  }

  // A trigger: the entry names the endpoint and the service
  const matches = findScheduledJobEntries(projectRoot, jobName, options.env);
  if (matches.length === 0) {
    const where = `.tsdevstack/infrastructure.json${options.env ? ` (${options.env})` : ''}`;
    throw new CliError(
      `No scheduled job named "${jobName}"`,
      'run-cron',
      serviceName
        ? `No ${APPS_DIR}/${serviceName}/${handlerFile}, and no entry of that name in ${where}. Add one with: npx tsdevstack register-cron --service ${serviceName} --name ${jobName}`
        : `No handler file apps/*/${handlerFile}, and no entry of that name in ${where}. Add one with: npx tsdevstack register-cron --name ${jobName}`,
    );
  }
  const { env, entry } = matches[0];
  if (matches.length > 1 && !options.env) {
    logger.info(
      `"${jobName}" is in ${matches.map((m) => m.env).join(', ')}; using the ${env} entry (pick one with --env)`,
    );
  }

  if (entry.type === CRON_JOB_TYPE) {
    const target = entry.targetService ?? serviceName ?? '<service>';
    throw new CliError(
      `Cron job "${jobName}" (${env}) has no handler file in ${APPS_DIR}/${target}`,
      'run-cron',
      `Expected ${handlerFile}. Create it with: npx tsdevstack register-cron --service ${target} --name ${jobName}`,
    );
  }

  await callTriggerLocally(config.services, jobName, env, entry);
}
