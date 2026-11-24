/**
 * Path and directory constants
 */

/**
 * Name of the tsdevstack configuration directory
 */
export const TSDEVSTACK_DIR = '.tsdevstack';

/**
 * Configuration file name
 */
export const CONFIG_FILENAME = 'config.json';

/**
 * Per-environment infrastructure settings (scheduled jobs, tiers, instances)
 * in .tsdevstack; the cloud plugins own its schema
 */
export const INFRASTRUCTURE_FILENAME = 'infrastructure.json';

/**
 * Monorepo directory structure
 */
export const APPS_DIR = 'apps';
export const PACKAGES_DIR = 'packages';

/**
 * Secret map file name (auto-generated, committed to git)
 * Maps each service to the secret keys it references
 */
export const SECRET_MAP_FILENAME = 'secret-map.json';

/**
 * npm package name of the CLI (used to locate the package root and its assets)
 */
export const CLI_PACKAGE_NAME = '@tsdevstack/cli';

/**
 * CLI assets that live in another package of this repository, by asset name:
 * the package and the folder inside it. From the sources (tests) the CLI
 * reads them there; the build copies each one to `dist/templates/<name>`, so
 * the published CLI has them where its other assets are and doesn't install
 * the package.
 * - `kong-plugins`: the framework Kong plugins, laid out as the public
 *   plugins repo.
 */
export const CLI_PACKAGE_ASSETS: Readonly<
  Record<string, { readonly packageName: string; readonly dir: string }>
> = {
  'kong-plugins': {
    packageName: '@tsdevstack/kong-plugins',
    dir: 'kong/plugins',
  },
};
