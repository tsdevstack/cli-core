/**
 * Load .secrets.tsdevstack.json (raw file structure)
 */

import * as path from 'path';
import { readJsonFile } from '../fs';
import { FRAMEWORK_SECRETS_FILE } from '../../constants';
import { findProjectRoot } from '../paths';
import type { SecretsFile } from './types';

/**
 * Load .secrets.tsdevstack.json (raw file structure)
 * Used for preserving DB passwords during regeneration
 *
 * @param rootDir - Project root directory (defaults to findProjectRoot())
 * @returns Parsed secrets file or null if doesn't exist
 */
export function loadFrameworkSecrets(
  rootDir: string = findProjectRoot(),
): SecretsFile | null {
  const frameworkSecretsPath = path.join(rootDir, FRAMEWORK_SECRETS_FILE);

  try {
    return readJsonFile<SecretsFile>(frameworkSecretsPath);
  } catch {
    // File doesn't exist or can't be parsed
    return null;
  }
}
