/**
 * List the plugin folders in a Kong plugins directory
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Returns the sorted names of the plugin folders in `dir` (one folder per
 * plugin). Symlinked folders count as folders. Files and hidden entries are
 * ignored. A missing directory has no plugins.
 */
export function listKongPluginDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter(
      (name) =>
        !name.startsWith('.') &&
        fs
          .statSync(path.join(dir, name), { throwIfNoEntry: false })
          ?.isDirectory() === true,
    )
    .sort();
}
