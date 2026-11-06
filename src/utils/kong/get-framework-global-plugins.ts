/**
 * Framework-owned global Kong plugins
 */

import type { KongPlugin } from './types';
import { generateStripIdentityPlugin } from './generate-strip-identity-plugin';
import { generateClientIpPlugin } from './generate-client-ip-plugin';
import { generateTrustPlugin } from './generate-trust-plugin';
import {
  generateOpenTelemetryPlugin,
  type KongTracingOptions,
} from './generate-opentelemetry-plugin';

/**
 * Returns the global plugins tsdevstack always generates into
 * kong.tsdevstack.yml (local and cloud). mergeKongConfigs puts them before
 * the user's global plugins and rejects user plugins with the same name.
 *
 * @param tracing - Where Kong's spans go and the environment's sample rate
 * @returns Framework global plugins
 */
export function getFrameworkGlobalPlugins(
  tracing: KongTracingOptions,
): KongPlugin[] {
  return [
    generateStripIdentityPlugin(),
    generateClientIpPlugin(),
    generateTrustPlugin(),
    generateOpenTelemetryPlugin(tracing),
  ];
}
