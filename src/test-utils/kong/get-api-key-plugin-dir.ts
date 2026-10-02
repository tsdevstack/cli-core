/**
 * Locate the tsdevstack-api-key Kong plugin sources
 */

import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * @returns Absolute path of the framework plugin folder
 *   (src/templates/kong-plugins/tsdevstack-api-key)
 */
export function getApiKeyPluginDir(): string {
  return path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'templates',
    'kong-plugins',
    'tsdevstack-api-key',
  );
}
