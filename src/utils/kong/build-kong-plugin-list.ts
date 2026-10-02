/**
 * Compose the KONG_PLUGINS list for the Kong image
 */

import { CliError } from '../errors';
import {
  KONG_BUNDLED_PLUGINS,
  KONG_OIDC_PLUGIN_NAME,
  KONG_PLUGINS_BUNDLED_KEYWORD,
  KONG_PLUGINS_DIR,
} from '../../constants';

export interface BuildKongPluginListOptions {
  /** Framework plugin names (folders shipped with the CLI) */
  frameworkPlugins: readonly string[];
  /** Project plugin names (folders in kong-plugins/ at the project root) */
  userPlugins: readonly string[];
}

/**
 * Returns the KONG_PLUGINS entries: `bundled`, the OIDC plugin, then the
 * framework plugins and the project plugins.
 *
 * Fails when a custom plugin reuses the name of a bundled, OIDC or framework
 * plugin: it would replace that plugin's files in the image.
 */
export function buildKongPluginList(
  options: BuildKongPluginListOptions,
): string[] {
  const reserved = new Set<string>([
    KONG_PLUGINS_BUNDLED_KEYWORD,
    ...KONG_BUNDLED_PLUGINS,
    KONG_OIDC_PLUGIN_NAME,
  ]);

  for (const name of options.frameworkPlugins) {
    if (reserved.has(name)) {
      throw new CliError(
        `Framework Kong plugin "${name}" collides with a plugin already in the Kong image`,
        'Kong image generation failed',
        'This is a tsdevstack packaging bug. Please report it.',
      );
    }
  }

  const frameworkNames = new Set<string>(options.frameworkPlugins);
  const collisions = options.userPlugins.filter(
    (name) => reserved.has(name) || frameworkNames.has(name),
  );

  if (collisions.length > 0) {
    throw new CliError(
      `Kong plugin name collision in ${KONG_PLUGINS_DIR}/: ${collisions.join(', ')}`,
      'Kong image generation failed',
      `Rename the folder(s) in ${KONG_PLUGINS_DIR}/ (and the plugin name in schema.lua). ` +
        `These names are taken by plugins bundled with Kong, the OIDC plugin (${KONG_OIDC_PLUGIN_NAME}) or tsdevstack framework plugins.`,
    );
  }

  return [
    KONG_PLUGINS_BUNDLED_KEYWORD,
    KONG_OIDC_PLUGIN_NAME,
    ...options.frameworkPlugins,
    ...options.userPlugins,
  ];
}
