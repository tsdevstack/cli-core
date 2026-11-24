import { CliError } from '../errors';
import {
  CRON_JOB_NAME_MAX_LENGTH,
  CRON_JOB_NAME_PATTERN,
  NAME_LENGTH,
} from '../../constants';

/**
 * A cron job's name: kebab-case (lowercase letters, digits, single hyphens,
 * starting with a letter, ending with a letter or digit), 2 to 40
 * characters. It names the handler file, its class, the lock and the cloud
 * job resources.
 *
 * @param name - The name to check
 * @throws {CliError} When the name doesn't fit
 */
export function validateCronJobName(name: string): void {
  const example = 'Example: usage-report';
  if (
    name.length < NAME_LENGTH.MIN_PREFIX ||
    name.length > CRON_JOB_NAME_MAX_LENGTH
  ) {
    throw new CliError(
      `Cron job name "${name}" must be ${NAME_LENGTH.MIN_PREFIX} to ${CRON_JOB_NAME_MAX_LENGTH} characters long`,
      'register-cron',
      example,
    );
  }
  if (!CRON_JOB_NAME_PATTERN.test(name) || name.includes('--')) {
    throw new CliError(
      `Cron job name "${name}" must be kebab-case: lowercase letters, digits and single hyphens, starting with a letter`,
      'register-cron',
      example,
    );
  }
}
