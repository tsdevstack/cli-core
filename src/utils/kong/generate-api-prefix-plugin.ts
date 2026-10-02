/**
 * Generates the tsdevstack-api-prefix plugin entry
 */

import {
  KONG_API_PREFIX_PLUGIN_NAME,
  KONG_PARTNER_PATH_PREFIX,
} from '../../constants';
import type { ApiPrefixPluginConfig } from './plugin-types';

/**
 * Returns the tsdevstack-api-prefix plugin for a partner service: partner
 * routes match `/api/{globalPrefix}/...`, the plugin removes `/api` from the
 * upstream path so the backend receives `/{globalPrefix}/...`.
 *
 * @returns Plugin entry with `prefix: /api`
 */
export function generateApiPrefixPlugin(): ApiPrefixPluginConfig {
  return {
    name: KONG_API_PREFIX_PLUGIN_NAME,
    config: {
      prefix: KONG_PARTNER_PATH_PREFIX,
    },
  };
}
