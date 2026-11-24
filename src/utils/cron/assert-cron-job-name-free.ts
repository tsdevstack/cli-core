import { CliError } from '../errors';
import {
  CRON_HANDLER_DIR,
  CRON_HANDLER_SUFFIX,
  CRON_JOB_TYPE,
} from '../../constants';
import type { FrameworkService } from '../config/types';
import { findCronHandlerServices } from './find-cron-handler-services';
import { findScheduledJobEntries } from './find-scheduled-job-entries';

/**
 * Scheduled job names are unique across the project, for both kinds: they
 * name the cloud schedules and job resources (`{project}-cron-{name}`).
 * Refuses a name another service has a handler file for, or that an entry
 * in infrastructure.json uses in any environment, unless that entry is this
 * same cron job of this same service (a rerun keeps working).
 *
 * @param projectRoot - The project root
 * @param serviceName - The service the cron job is registered on
 * @param jobName - The cron job's name
 * @param services - The services from config.json
 * @throws {CliError} When the name is taken
 */
export function assertCronJobNameFree(
  projectRoot: string,
  serviceName: string,
  jobName: string,
  services: FrameworkService[],
): void {
  const hint =
    'Scheduled job names are unique across the project, for both kinds: they name the cloud schedules and job resources';

  const others = findCronHandlerServices(projectRoot, jobName, services).filter(
    (name) => name !== serviceName,
  );
  if (others.length > 0) {
    throw new CliError(
      `Cron job name "${jobName}" is taken: ${others.join(', ')} already has ${CRON_HANDLER_DIR}/${jobName}${CRON_HANDLER_SUFFIX}`,
      'register-cron',
      hint,
    );
  }

  const taken = findScheduledJobEntries(projectRoot, jobName).filter(
    ({ entry }) =>
      !(entry.type === CRON_JOB_TYPE && entry.targetService === serviceName),
  );
  if (taken.length > 0) {
    const where = taken
      .map(
        ({ env, entry }) =>
          `${env} (${entry.type === CRON_JOB_TYPE ? `cron job of ${entry.targetService}` : 'trigger'})`,
      )
      .join(', ');
    throw new CliError(
      `Scheduled job name "${jobName}" is taken in infrastructure.json: ${where}`,
      'register-cron',
      hint,
    );
  }
}
