import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: ['node 18'],
      dts: false, // CLI binary doesn't need declarations - plugin types exported from source
      autoExternal: true,
      source: {
        entry: {
          cli: './src/cli.ts',
        },
      },
      output: {
        minify: true,
        copy: [
          { from: './src/templates', to: './templates' },
          { from: './src/swagger-ts-templates', to: './swagger-ts-templates' },
        ],
      },
    },
  ],
});
