import {
  CRON_JOB_TYPE,
  DEFAULT_CRON_JOB_TIMEOUT_SECONDS,
  EXAMPLE_CRON_SCHEDULE,
} from '../../constants';

/** A cron job's entry in an environment's `scheduledJobs` */
export interface CronJobEntry {
  name: string;
  type: typeof CRON_JOB_TYPE;
  schedule: string;
  targetService: string;
  timeout: number;
}

/**
 * The infrastructure.json entry `register-cron` prints: the defaults filled
 * in, the schedule an example to edit. `cpu`, `memory` and `timezone` are
 * optional and left out (the migration job's values and UTC apply).
 *
 * @param jobName - The cron job's name
 * @param targetService - The service whose image runs it
 */
export function buildCronJobEntry(
  jobName: string,
  targetService: string,
): CronJobEntry {
  return {
    name: jobName,
    type: CRON_JOB_TYPE,
    schedule: EXAMPLE_CRON_SCHEDULE,
    targetService,
    timeout: DEFAULT_CRON_JOB_TIMEOUT_SECONDS,
  };
}
