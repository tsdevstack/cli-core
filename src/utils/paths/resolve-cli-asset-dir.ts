/**
 * Resolve a directory of assets shipped with the CLI package
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { CliError } from '../errors';
import { CLI_PACKAGE_NAME, CLI_PACKAGE_ASSETS } from '../../constants';
import { resolvePackageAssetDir } from './resolve-package-asset-dir';

/**
 * Returns the absolute path of `relativePath` inside the CLI templates
 * directory (`src/templates` in the repository, copied to `dist/templates`
 * by the build).
 *
 * Works from the bundled CLI (dist/cli.js), the plugin entry
 * (dist/plugin/index.js) and the sources (tests): walks up from this module
 * to the package root, then picks dist/templates when running from dist and
 * src/templates otherwise. From the sources, an asset that lives in another
 * package of the repository (CLI_PACKAGE_ASSETS: the framework Kong plugins)
 * comes from that package.
 *
 * @param relativePath - Path inside the templates directory (e.g. "kong-plugins")
 * @param fromDir - Start directory (defaults to this module's directory; for tests)
 */
export function resolveCliAssetDir(
  relativePath: string,
  fromDir: string = path.dirname(fileURLToPath(import.meta.url)),
): string {
  let current = fromDir;

  while (true) {
    const packageJsonPath = path.join(current, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(
        fs.readFileSync(packageJsonPath, 'utf-8'),
      ) as { name?: string };

      if (packageJson.name === CLI_PACKAGE_NAME) {
        const distDir = path.join(current, 'dist');
        const fromDist =
          fromDir === distDir || fromDir.startsWith(distDir + path.sep);
        const templatesDir = path.join(
          current,
          fromDist ? 'dist' : 'src',
          'templates',
        );
        const packageAsset = CLI_PACKAGE_ASSETS[relativePath];
        const assetDir =
          !fromDist && packageAsset
            ? resolvePackageAssetDir(packageJsonPath, packageAsset)
            : path.join(templatesDir, relativePath);

        if (!fs.existsSync(assetDir)) {
          throw new CliError(
            `CLI asset directory not found: ${assetDir}`,
            'Resolving CLI assets',
            'Reinstall @tsdevstack/cli. If you build it from source, run its build.',
          );
        }

        return assetDir;
      }
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new CliError(
        `Could not find the ${CLI_PACKAGE_NAME} package root from ${fromDir}`,
        'Resolving CLI assets',
        'Reinstall @tsdevstack/cli.',
      );
    }
    current = parent;
  }
}
