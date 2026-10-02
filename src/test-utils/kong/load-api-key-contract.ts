/**
 * Load the API key Redis contract from @tsdevstack/nest-common
 */

import { createRequire } from 'module';

/** The nest-common module (only the API key contract is used by the tests) */
export type ApiKeyContract = typeof import('@tsdevstack/nest-common');

/**
 * Loads @tsdevstack/nest-common through its CommonJS entry.
 *
 * The package's ESM entry (dist/index.mjs) imports @opentelemetry/api's ESM
 * build, which does not load under the test runner's ESM resolution; the
 * CommonJS entry does. The contract functions are the same in both.
 */
export function loadApiKeyContract(): ApiKeyContract {
  const require = createRequire(import.meta.url);
  return require('@tsdevstack/nest-common') as ApiKeyContract;
}
