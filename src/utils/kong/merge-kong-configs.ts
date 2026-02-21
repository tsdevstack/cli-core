import type { KongTemplate } from './types';

/**
 * Merges framework-generated Kong config with user customizations.
 *
 * Simple concat strategy - no overlap, no complex merging logic:
 * - Framework file (kong.tsdevstack.yml): services + consumers (auto-generated from OpenAPI + partner-api-keys)
 * - User file (kong.user.yml): plugins, optionally custom services
 * - No duplication risk because framework never touches plugins
 *
 * @param tsdevstackConfig - Framework-generated routes and consumers from OpenAPI specs + .secrets.user.json
 * @param userConfig - User customizations (plugins, optional custom services)
 * @returns Merged Kong configuration
 */
export function mergeKongConfigs(
  tsdevstackConfig: KongTemplate,
  userConfig: KongTemplate,
): KongTemplate {
  const merged: KongTemplate = {
    _format_version: '3.0',
    _transform: true,
    services: [],
    consumers: [],
    plugins: [],
  };

  // 1. Framework services (from kong.tsdevstack.yml)
  // These are auto-generated from OpenAPI specs with auth plugins attached
  merged.services = [...(tsdevstackConfig.services || [])];

  // 2. User custom services (from kong.user.yml - optional)
  // Users can add external API proxies, custom routing, etc.
  if (userConfig.services && userConfig.services.length > 0) {
    merged.services.push(...userConfig.services);
  }

  // 3. Consumers (from both framework and user files)
  // Framework: auto-generated from .secrets.user.json partner-api-keys section
  // User: manual consumers in kong.user.yml
  merged.consumers = [
    ...(tsdevstackConfig.consumers || []),
    ...(userConfig.consumers || []),
  ];

  // 4. Global plugins (only from user file)
  // Operational plugins: CORS, rate-limiting, trust header, correlation-id
  merged.plugins = userConfig.plugins || [];

  return merged;
}