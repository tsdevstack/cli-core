import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      // CLI binary — bundles private packages (devDeps), externalizes cloud SDKs (deps)
      format: 'esm',
      syntax: ['node 18'],
      dts: false,
      autoExternal: true,
      source: {
        entry: {
          cli: './src/cli.ts',
        },
      },
      output: {
        minify: true,
        externals: ['@tsdevstack/cli', '@tsdevstack/cli/plugin'],
        copy: [
          { from: './src/templates', to: './templates' },
          { from: './src/swagger-ts-templates', to: './swagger-ts-templates' },
        ],
      },
    },
    {
      // Plugin API — JS + types for external consumers (cli-mcp)
      format: 'esm',
      syntax: ['node 18'],
      dts: true,
      autoExternal: true,
      source: {
        entry: {
          'plugin/index': './src/plugin/index.ts',
        },
      },
      output: {
        externals: ['@tsdevstack/cli', '@tsdevstack/cli/plugin'],
      },
    },
  ],
});
