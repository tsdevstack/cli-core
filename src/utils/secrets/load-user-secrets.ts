/**
 * Load .secrets.user.json (raw file structure)
 */

import * as path from 'path';
import { readJsonFile } from '../fs';
import { USER_SECRETS_FILE } from '../../constants';
import { findProjectRoot } from '../paths';
import type { SecretsFile } from './types';

/**
 * Load .secrets.user.json (raw file structure)
 *
 * @param rootDir - Project root directory (defaults to findProjectRoot())
 * @returns Parsed secrets file or null if doesn't exist
 */
export function loadUserSecrets(
  rootDir: string = findProjectRoot(),
): SecretsFile | null {
  const userSecretsPath = path.join(rootDir, USER_SECRETS_FILE);

  try {
    return readJsonFile<SecretsFile>(userSecretsPath);
  } catch {
    // File doesn't exist or can't be parsed
    return null;
  }
}
