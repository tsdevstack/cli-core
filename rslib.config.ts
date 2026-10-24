import { defineConfig } from '@rslib/core';

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
