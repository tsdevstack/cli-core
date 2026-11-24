/**
 * Resolve a folder of CLI assets kept in another package of the repository
 */

import * as path from 'path';
import { createRequire } from 'module';
import { CliError } from '../errors';

/**
 * Finds `asset.packageName` the way Node would from the CLI package
 * (node_modules, where npm links the repository's workspace packages) and
 * returns `asset.dir` inside it. Used from the sources only: the built CLI
 * carries a copy in dist/templates.
 *
 * @param cliPackageJsonPath - The CLI's package.json (the lookup starts there)
 * @param asset - The package and the folder inside it
 * @returns Absolute path of the folder
 * @throws CliError when the package or the folder is missing
 */
export function resolvePackageAssetDir(
  cliPackageJsonPath: string,
  asset: { readonly packageName: string; readonly dir: string },
): string {
  let packageRoot: string;
  try {
    packageRoot = path.dirname(
      createRequire(cliPackageJsonPath).resolve(
        `${asset.packageName}/package.json`,
      ),
    );
  } catch {
    throw new CliError(
      `Package ${asset.packageName} not found from ${path.dirname(cliPackageJsonPath)}`,
      'Resolving CLI assets',
      'Run npm install at the repository root.',
    );
  }

  return path.join(packageRoot, ...asset.dir.split('/'));
}
