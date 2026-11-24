import { logger } from '../logger';
import { CliError } from '../errors';
import { DEFAULT_TRIGGER_RUN_TIMEOUT_SECONDS } from '../../constants';
import type { ScheduledJobEntryLike } from './find-scheduled-job-entries';

/**
 * Call a trigger's endpoint on its service's local port, with the entry's
 * method (default POST); the SchedulerGuard lets local calls through. Prints
 * the status and the body; a failed response sets exit code 1.
 *
 * @param services - The services from config.json (name and port)
 * @param jobName - The trigger's name
 * @param env - The environment the entry comes from, for the messages
 * @param entry - The trigger's entry
 * @throws {CliError} When the entry or its service can't be called
 */
export async function callTriggerLocally(
  services: Array<{ name: string; port?: number }>,
  jobName: string,
  env: string,
  entry: ScheduledJobEntryLike,
): Promise<void> {
  const target = services.find((s) => s.name === entry.targetService);
  if (!target?.port) {
    throw new CliError(
      `Trigger "${jobName}" (${env}) targets "${entry.targetService}", which has no local port in config.json`,
      'run-cron',
      'A trigger calls a NestJS service that is in config.json with a port',
    );
  }
  if (!entry.endpoint) {
    throw new CliError(
      `Trigger "${jobName}" (${env}) has no endpoint`,
      'run-cron',
      'A trigger entry needs "endpoint" (and "method", default POST)',
    );
  }

  const method = entry.method ?? 'POST';
  const url = `http://localhost:${target.port}${entry.endpoint}`;
  const timeoutSeconds =
    entry.httpTimeout ?? DEFAULT_TRIGGER_RUN_TIMEOUT_SECONDS;
  logger.info(
    `Calling trigger "${jobName}" (${env}) locally: ${method} ${url}`,
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      signal: AbortSignal.timeout(timeoutSeconds * 1000),
    });
  } catch (error) {
    throw new CliError(
      `Could not reach ${url}: ${error instanceof Error ? error.message : String(error)}`,
      'run-cron',
      `Is ${entry.targetService} running? Start the stack with: npm run dev`,
    );
  }

  const body = (await response.text()).slice(0, 2000);
  if (response.ok) {
    logger.success(`${response.status} ${response.statusText}`.trim());
  } else {
    logger.error(`${response.status} ${response.statusText}`.trim());
    process.exitCode = 1;
  }
  if (body) {
    logger.info(body);
  }
}
