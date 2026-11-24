import path from 'node:path';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { logger } from '../logger';
import { CliError } from '../errors';
import {
  APPS_DIR,
  CRON_EXIT_NOT_STARTED,
  CRON_MODULE_FILE,
  CRON_SCRIPTS,
} from '../../constants';
import { buildCronClassName } from './build-cron-class-name';

/**
 * Run a cron job's handler once against the local stack: `npm run cron --
 * <name>` in the service's folder, output passed through. The run's exit
 * code becomes this process's exit code; on exit 2 (the job never started,
 * usually a handler not listed in the module) the two lines to add are
 * printed.
 *
 * @param projectRoot - The project root
 * @param serviceName - The service that has the handler
 * @param jobName - The cron job's name
 * @throws {CliError} When the service has no cron script
 */
export function runCronJobLocally(
  projectRoot: string,
  serviceName: string,
  jobName: string,
): void {
  const serviceDir = path.join(projectRoot, APPS_DIR, serviceName);
  const pkg = JSON.parse(
    fs.readFileSync(path.join(serviceDir, 'package.json'), 'utf-8'),
  ) as { scripts?: Record<string, string> };
  const scriptName = Object.keys(CRON_SCRIPTS)[0];
  if (!pkg.scripts?.[scriptName]) {
    throw new CliError(
      `${APPS_DIR}/${serviceName}/package.json has no "${scriptName}" script`,
      'run-cron',
      `Run again: npx tsdevstack register-cron --service ${serviceName} --name ${jobName} (it adds the script and keeps your files)`,
    );
  }

  logger.info(
    `Running cron job "${jobName}" of ${serviceName} locally: npm run ${scriptName} -- ${jobName}`,
  );
  logger.newline();
  const result = spawnSync('npm', ['run', scriptName, '--', jobName], {
    cwd: serviceDir,
    stdio: 'inherit',
  });
  logger.newline();

  const code = result.status ?? 1;
  if (code === 0) {
    logger.success(`Cron job "${jobName}" finished (exit 0)`);
    return;
  }

  logger.error(`Cron job "${jobName}" exited with code ${code}`);
  if (code === CRON_EXIT_NOT_STARTED) {
    const className = buildCronClassName(jobName);
    logger.info(
      `Exit ${code} means the job never started. If the handler isn't listed in ${APPS_DIR}/${serviceName}/${CRON_MODULE_FILE}, add:`,
    );
    logger.info(`  import { ${className} } from './cron/${jobName}.cron';`);
    logger.info(`  ${className},   (in the handlers list)`);
  }
  process.exitCode = code;
}
