import { defineConfig } from '@rstest/core';
import { withRslibConfig } from '@rstest/adapter-rslib';

export default defineConfig({
  extends: withRslibConfig(),
  coverage: {
    include: ['src/**/*.ts'],
    exclude: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/index.ts',
      '**/*.interface.ts',
      '**/types.ts',
      'src/constants/**',
      'src/test-utils/**',
      'src/test-fixtures/**',
      'src/cli.ts',
      'src/plugin/context.ts',
      '**/plugin-types.ts',
      '**/package-json-types.ts',
      '**/operation-context.ts',
    ],
  },
});
