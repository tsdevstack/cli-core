/**
 * Fingerprint of what the published Kong plugins version stands for: every
 * file of every framework plugin (path and content; hidden files and
 * folders such as .DS_Store are skipped, as they are never published) and
 * the image's base layers (Kong, the OIDC plugin, the log level change).
 * Compared with KONG_PLUGINS_FINGERPRINT by its test, so a change without a
 * KONG_PLUGINS_VERSION bump fails.
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { buildKongBaseLayers } from './build-kong-base-layers';

export function computeKongPluginsFingerprint(pluginsDir: string): string {
  const hash = createHash('sha256');

  const walk = (dir: string): string[] =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.'))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(full) : [full];
      });

  for (const file of walk(pluginsDir)) {
    hash.update(path.relative(pluginsDir, file).split(path.sep).join('/'));
    hash.update('\0');
    hash.update(fs.readFileSync(file));
    hash.update('\0');
  }
  hash.update(buildKongBaseLayers());

  return hash.digest('hex');
}
