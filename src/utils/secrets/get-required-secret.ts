/**
 * Get required secret value with validation
 */

import { CliError } from '../errors';
import type { Secrets } from './types';

/**
 * Get specific secret value with validation
 * Throws error if required secret is missing
 *
 * @param secrets - Flattened secrets object
 * @param key - Secret key to retrieve
 * @param errorMessage - Custom error message if secret is missing
 * @returns Secret value
 * @throws {CliError} If secret is missing
 */
export function getRequiredSecret(
  secrets: Secrets,
  key: string,
  errorMessage?: string
): string {
  const value = secrets[key];

  if (!value) {
    // If custom error message provided, use it as-is for backwards compatibility
    // Otherwise, use structured CliError format
    if (errorMessage) {
      throw new CliError(errorMessage);
    } else {
      throw new CliError(
        `Expected ${key} in .secrets.local.json`,
        'Required secret missing',
        'Run: npx tsdevstack generate-secrets'
      );
    }
  }

  return value;
}