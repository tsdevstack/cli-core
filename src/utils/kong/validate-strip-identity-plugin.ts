/**
 * Warn when a custom Kong config lacks tsdevstack-strip-identity
 */

import type { KongTemplate } from './types';
import { logger } from '../logger';
import { KONG_STRIP_IDENTITY_PLUGIN_NAME } from '../../constants';

/**
 * Checks that `config` declares tsdevstack-strip-identity as a global plugin
 * and logs a warning when it does not. Used for kong.custom.yml, which the
 * framework does not generate or merge.
 *
 * @param config - Kong config (kong.custom.yml)
 * @param fileName - File name for the warning
 * @returns true when the plugin is present
 */
export function validateStripIdentityPlugin(
  config: KongTemplate,
  fileName: string,
): boolean {
  const present = (config.plugins || []).some(
    (plugin) => plugin.name === KONG_STRIP_IDENTITY_PLUGIN_NAME,
  );

  if (!present) {
    logger.warn(
      `${fileName} has no global ${KONG_STRIP_IDENTITY_PLUGIN_NAME} plugin: clients can send forged identity headers (X-Userinfo, X-Consumer-*, X-Api-Key-*) to your backends.`,
    );
    logger.warn(
      `   Add it to the plugins list: - name: ${KONG_STRIP_IDENTITY_PLUGIN_NAME}`,
    );
  }

  return present;
}
