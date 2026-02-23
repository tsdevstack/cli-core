/**
 * Load the full .secrets.local.json file structure
 */

import * as path from 'path';
import { readJsonFile } from '../fs';
import { CliError } from '../errors';
import { LOCAL_SECRETS_FILE } from '../../constants';
import { findProjectRoot } from '../paths';
import type { SecretsFile } from './types';

/**
 * Load the full .secrets.local.json file (SecretsFile structure)
 *
 * @param rootDir - Project root directory (defaults to findProjectRoot())
 * @returns Full secrets file structure
 * @throws {CliError} If secrets file not found
 */
export function loadLocalSecretsFile(
  rootDir: string = findProjectRoot(),
): SecretsFile {
  const secretsPath = path.join(rootDir, LOCAL_SECRETS_FILE);

  try {
    return readJsonFile<SecretsFile>(secretsPath);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CliError(
      `Expected ${LOCAL_SECRETS_FILE} in project root. ${errorMessage}`,
      'Secrets file not found',
      'Run: npx tsdevstack generate-secrets',
    );
  }
}
