/**
 * Resolve the per-IP ceiling of partner routes
 */

import type { FrameworkConfig } from './types';
import { CliError } from '../errors';
import { KONG_API_KEY_IP_LIMIT_PER_MINUTE_DEFAULT } from '../../constants';

/**
 * Returns `framework.apiKeys.ipLimitPerMinute` from .tsdevstack/config.json,
 * or the default (600) when it is not set.
 *
 * @param config - Framework config
 * @returns Requests per minute per client IP on partner routes
 * @throws CliError when the value is not a positive integer
 */
export function resolveApiKeyIpLimit(
  config: Pick<FrameworkConfig, 'framework'>,
): number {
  const value: unknown = config.framework?.apiKeys?.ipLimitPerMinute;
  if (value === undefined) {
    return KONG_API_KEY_IP_LIMIT_PER_MINUTE_DEFAULT;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new CliError(
      `framework.apiKeys.ipLimitPerMinute must be a positive integer, got ${JSON.stringify(value)}`,
      'Invalid .tsdevstack/config.json',
      `Set it to the requests per minute one client IP may send to partner routes, or remove it to use the default (${KONG_API_KEY_IP_LIMIT_PER_MINUTE_DEFAULT}).`,
    );
  }

  return value;
}
