/**
 * Generates the tsdevstack-api-key plugin entry
 */

import {
  KONG_API_KEY_HEADER_NAMES,
  KONG_API_KEY_PLUGIN_NAME,
} from '../../constants';
import type { ApiKeyDefaultLimits, ApiKeyPluginConfig } from './plugin-types';
import { buildKongRedisConfig } from './build-kong-redis-config';

/**
 * Returns the tsdevstack-api-key plugin for a partner service. It reads the
 * key from `x-api-key`, checks it against the key records in Redis and
 * applies the key's own limits, falling back per window to `defaultLimits`
 * (the global rate-limiting values of kong.user.yml).
 *
 * @param defaultLimits - Limits for keys without their own (may be empty)
 * @returns Plugin entry
 */
export function generateApiKeyPlugin(
  defaultLimits: ApiKeyDefaultLimits,
): ApiKeyPluginConfig {
  return {
    name: KONG_API_KEY_PLUGIN_NAME,
    config: {
      key_names: [...KONG_API_KEY_HEADER_NAMES],
      redis: buildKongRedisConfig(),
      default_limits: { ...defaultLimits },
    },
  };
}
