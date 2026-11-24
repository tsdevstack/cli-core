import * as fs from 'fs';
import * as path from 'path';
import { INFRASTRUCTURE_FILENAME, TSDEVSTACK_DIR } from '../../constants';

/** What `run-cron` needs from a `scheduledJobs` entry (the cloud plugins own the full schema) */
export interface ScheduledJobEntryLike {
  name: string;
  type?: string;
  targetService?: string;
  endpoint?: string;
  method?: string;
  httpTimeout?: number;
}

export interface ScheduledJobEntryMatch {
  /** The environment whose list holds the entry */
  env: string;
  entry: ScheduledJobEntryLike;
}

/**
 * The entries named `jobName` in .tsdevstack/infrastructure.json, across
 * every environment, or in one. No file, no entries.
 *
 * @param projectRoot - The project root
 * @param jobName - The scheduled job's name
 * @param env - One environment only (default: all)
 */
export function findScheduledJobEntries(
  projectRoot: string,
  jobName: string,
  env?: string,
): ScheduledJobEntryMatch[] {
  const file = path.join(projectRoot, TSDEVSTACK_DIR, INFRASTRUCTURE_FILENAME);
  if (!fs.existsSync(file)) {
    return [];
  }
  const infra = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<
    string,
    unknown
  >;

  const matches: ScheduledJobEntryMatch[] = [];
  for (const [envName, envConfig] of Object.entries(infra)) {
    if (env && envName !== env) continue;
    if (!envConfig || typeof envConfig !== 'object') continue;
    const jobs = (envConfig as { scheduledJobs?: unknown }).scheduledJobs;
    if (!Array.isArray(jobs)) continue;
    for (const job of jobs) {
      if (
        job &&
        typeof job === 'object' &&
        (job as { name?: unknown }).name === jobName
      ) {
        matches.push({ env: envName, entry: job as ScheduledJobEntryLike });
      }
    }
  }
  return matches;
}
