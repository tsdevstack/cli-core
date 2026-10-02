/**
 * Generates the tsdevstack-strip-identity plugin entry
 */

import { KONG_STRIP_IDENTITY_PLUGIN_NAME } from '../../constants';
import type { StripIdentityPluginConfig } from './plugin-types';

/**
 * Returns the global tsdevstack-strip-identity plugin: removes client-sent
 * identity headers (X-Userinfo, X-Consumer-*, X-Api-Key-*, ...) before any
 * auth plugin runs, so backends only see identity set by Kong.
 *
 * @returns Plugin entry (no settings)
 */
export function generateStripIdentityPlugin(): StripIdentityPluginConfig {
  return {
    name: KONG_STRIP_IDENTITY_PLUGIN_NAME,
    config: {},
  };
}
