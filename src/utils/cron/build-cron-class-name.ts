import { transformKey } from 'deep-case-crafter';

/**
 * The handler class of a cron job: `usage-report` becomes `UsageReportCron`
 *
 * @param jobName - The job's kebab-case name
 */
export function buildCronClassName(jobName: string): string {
  return `${transformKey(jobName, { targetCase: 'pascal' })}Cron`;
}
