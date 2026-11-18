/**
 * Generates the per-IP ceiling of a partner service
 */

import { KONG_RATE_LIMITING_PLUGIN_NAME } from '../../constants';
import type { IpCeilingPluginConfig } from './plugin-types';
import { buildKongRedisConfig } from './build-kong-redis-config';

/**
 * Returns a service-scoped rate-limiting plugin counted per client IP. On
 * the partner service it replaces the global limiter (Kong runs one
 * instance per plugin name, the most specific scope wins); per-key limits
 * are enforced by tsdevstack-api-key, which runs after it (priority 900
 * after 910), so requests with invalid keys are counted here too. It bounds
 * key guessing, it is not a usage limit.
 *
 * `hide_client_headers` stays false, so the ceiling's own 429 carries
 * Retry-After. tsdevstack-api-key clears the ceiling's headers first thing
 * in its access phase, so clients only see them on that 429.
 *
 * @param ipLimitPerMinute - Requests per minute per client IP
 * @returns Plugin entry
 */
export function generateIpCeilingPlugin(
  ipLimitPerMinute: number,
): IpCeilingPluginConfig {
  return {
    name: KONG_RATE_LIMITING_PLUGIN_NAME,
    config: {
      minute: ipLimitPerMinute,
      limit_by: 'ip',
      policy: 'redis',
      hide_client_headers: false,
      redis: buildKongRedisConfig(),
    },
  };
}
