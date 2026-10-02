/**
 * Framework-owned global Kong plugins
 */

import type { KongPlugin } from './types';
import { generateStripIdentityPlugin } from './generate-strip-identity-plugin';

/**
 * Returns the global plugins tsdevstack always generates into
 * kong.tsdevstack.yml (local and cloud). mergeKongConfigs puts them before
 * the user's global plugins and rejects user plugins with the same name.
 *
 * @returns Framework global plugins
 */
export function getFrameworkGlobalPlugins(): KongPlugin[] {
  return [generateStripIdentityPlugin()];
}
