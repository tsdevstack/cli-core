import type { KongTemplate } from './types';
import { CliError } from '../errors';

/**
 * Merges framework-generated Kong config with user customizations.
 *
 * Simple concat strategy:
 * - Framework file (kong.tsdevstack.yml): services generated from OpenAPI,
 *   consumers, and the framework global plugins (tsdevstack-strip-identity)
 * - User file (kong.user.yml): global plugins, optionally custom services
 *   and consumers
 *
 * Framework global plugins come first. Kong accepts one global instance per
 * plugin name, so a user global plugin with a framework plugin's name fails
 * here with a hint instead of at Kong startup.
 *
 * @param tsdevstackConfig - Framework-generated config (kong.tsdevstack.yml)
 * @param userConfig - User customizations (kong.user.yml)
 * @returns Merged Kong configuration
 * @throws CliError when the user file declares a framework global plugin
 */
export function mergeKongConfigs(
  tsdevstackConfig: KongTemplate,
  userConfig: KongTemplate,
): KongTemplate {
  const frameworkPlugins = tsdevstackConfig.plugins || [];
  const userPlugins = userConfig.plugins || [];

  const frameworkNames = new Set(frameworkPlugins.map((p) => p.name));
  const collisions = [
    ...new Set(
      userPlugins.map((p) => p.name).filter((n) => frameworkNames.has(n)),
    ),
  ];
  if (collisions.length > 0) {
    throw new CliError(
      `kong.user.yml declares global plugin(s) that tsdevstack already generates: ${collisions.join(', ')}`,
      'Kong configuration merge failed',
      'Remove them from the plugins list in kong.user.yml. Framework plugins are added to kong.tsdevstack.yml automatically, and Kong allows one global instance per plugin name.',
    );
  }

  return {
    _format_version: '3.0',
    _transform: true,
    // Framework services first, then user custom services (external APIs, etc.)
    services: [
      ...(tsdevstackConfig.services || []),
      ...(userConfig.services || []),
    ],
    consumers: [
      ...(tsdevstackConfig.consumers || []),
      ...(userConfig.consumers || []),
    ],
    // Framework global plugins first, then the user's operational plugins
    // (CORS, rate-limiting, trust header, correlation-id)
    plugins: [...frameworkPlugins, ...userPlugins],
  };
}
