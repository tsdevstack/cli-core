/**
 * Build the framework Kong config (kong.tsdevstack.yml content)
 */

import type { KongService, KongTemplate } from './types';
import { getFrameworkGlobalPlugins } from './get-framework-global-plugins';
import type { KongTracingOptions } from './generate-opentelemetry-plugin';

/**
 * Returns the framework part of the Kong config: the generated services and
 * the framework global plugins. Local (generate-kong) and cloud
 * (infra:generate-kong) generation both build it here, so both get the same
 * routes and plugins.
 *
 * @param services - Services from generateSecurityBasedServices
 * @param tracing - Where Kong's spans go and the environment's sample rate
 * @returns Framework Kong config, merged with kong.user.yml by mergeKongConfigs
 */
export function buildFrameworkKongConfig(
  services: KongService[],
  tracing: KongTracingOptions,
): KongTemplate {
  return {
    _format_version: '3.0',
    _transform: true,
    services,
    plugins: getFrameworkGlobalPlugins(tracing),
  };
}
