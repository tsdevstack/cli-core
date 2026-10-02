/**
 * Warn about static partner keys (key-auth consumers) in a Kong config
 */

import type { KongTemplate } from './types';
import { logger } from '../logger';

/**
 * Static partner keys are no longer supported: partner routes use
 * tsdevstack-api-key (keys in Redis, managed by the auth-service admin API).
 * Consumers with `keyauth_credentials` are still merged into kong.yml as
 * written, but no framework route authenticates with them. Logs one warning
 * block when the file still has any.
 *
 * @param config - Kong config from a user-owned file
 * @param fileName - File name for the warning (e.g. kong.user.yml)
 * @returns Usernames of the consumers with keyauth_credentials
 */
export function warnStaticPartnerConsumers(
  config: KongTemplate,
  fileName: string,
): string[] {
  const usernames = (config.consumers ?? [])
    .filter(
      (consumer) =>
        Array.isArray(consumer.keyauth_credentials) &&
        consumer.keyauth_credentials.length > 0,
    )
    .map((consumer) => consumer.username);

  if (usernames.length > 0) {
    logger.warn(
      `${fileName}: consumers with keyauth_credentials (${usernames.join(', ')}): static partner keys are no longer supported, partner routes ignore them.`,
    );
    logger.warn(
      '   Partner routes check API keys created through the auth-service admin API (POST /v1/admin/api-keys under its global prefix), or records your own tooling writes to Redis.',
    );
    logger.warn(
      '   Create keys for these partners, hand them over, then remove the consumers from this file and their key secrets.',
    );
  }

  return usernames;
}
