import { createRequire } from 'node:module';
import * as path from 'node:path';
import { defineConfig } from '@rslib/core';
import { CLI_PACKAGE_ASSETS } from './src/constants/paths.ts';

const require = createRequire(import.meta.url);

// Assets kept in other packages of the repository (the framework Kong
// plugins), copied to dist/templates/<name>, where the built CLI reads them
const packageAssetCopies = Object.entries(CLI_PACKAGE_ASSETS).map(
  ([name, asset]) => ({
    from: path.join(
      path.dirname(require.resolve(`${asset.packageName}/package.json`)),
      ...asset.dir.split('/'),
    ),
    to: `./templates/${name}`,
  }),
);

export default defineConfig({
  lib: [
    {
      // CLI binary — bundles private packages (devDeps), externalizes cloud SDKs (deps)
      format: 'esm',
      syntax: ['node 18'],
      dts: false,
      source: {
        entry: {
          cli: './src/cli.ts',
        },
      },
      tools: {
        rspack: {
          optimization: {
            chunkIds: 'named',
          },
        },
      },
      output: {
        autoExternal: true,
        minify: true,
        externals: ['@tsdevstack/cli', '@tsdevstack/cli/plugin'],
        copy: [
          { from: './src/templates', to: './templates' },
          ...packageAssetCopies,
          {
            from: './src/swagger-ts-templates',
            to: './swagger-ts-templates',
            globOptions: { ignore: ['**/*.test.ts'] },
          },
        ],
      },
    },
    {
      // Plugin API — JS + types for external consumers (cli-mcp)
      format: 'esm',
      syntax: ['node 18'],
      dts: true,
      source: {
        entry: {
          'plugin/index': './src/plugin/index.ts',
        },
      },
      output: {
        autoExternal: true,
        externals: ['@tsdevstack/cli', '@tsdevstack/cli/plugin'],
      },
    },
  ],
});
