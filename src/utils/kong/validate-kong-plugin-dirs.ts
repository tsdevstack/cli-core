/**
 * Validate custom Kong plugin folders before they are staged
 */

import * as fs from 'fs';
import * as path from 'path';
import { CliError } from '../errors';
import {
  KONG_PLUGIN_NAME_PATTERN,
  KONG_PLUGIN_REQUIRED_FILES,
  KONG_PLUGINS_DIR,
} from '../../constants';

export interface KongPluginDir {
  /** Plugin name (the folder name) */
  name: string;
  /** Absolute path of the plugin folder */
  dir: string;
}

/**
 * Fails with one CliError listing every plugin folder whose name is not a
 * valid plugin name or that lacks handler.lua or schema.lua.
 */
export function validateKongPluginDirs(
  plugins: readonly KongPluginDir[],
): void {
  const problems: string[] = [];

  for (const plugin of plugins) {
    if (!KONG_PLUGIN_NAME_PATTERN.test(plugin.name)) {
      problems.push(`${plugin.dir}: invalid plugin name "${plugin.name}"`);
    }
    const missing = KONG_PLUGIN_REQUIRED_FILES.filter(
      (file) => !fs.existsSync(path.join(plugin.dir, file)),
    );
    if (missing.length > 0) {
      problems.push(`${plugin.dir}: missing ${missing.join(', ')}`);
    }
  }

  if (problems.length > 0) {
    throw new CliError(
      `Invalid Kong plugin folder(s):\n  - ${problems.join('\n  - ')}`,
      'Kong image generation failed',
      `Each folder in ${KONG_PLUGINS_DIR}/ is one Kong plugin: name it with lowercase letters, digits, "-" or "_" ` +
        `(e.g. my-plugin), matching the name in its schema.lua, and include ${KONG_PLUGIN_REQUIRED_FILES.join(' and ')}.`,
    );
  }
}
