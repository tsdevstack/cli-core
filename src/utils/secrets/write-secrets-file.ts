/**
 * Write secrets file to disk
 */

import * as path from 'path';
import { writeJsonFile } from '../fs';
import { findProjectRoot } from '../paths';
import type { SecretsFile } from './types';

/**
 * Write secrets file to disk
 *
 * @param filename - Name of the secrets file (e.g., '.secrets.tsdevstack.json')
 * @param secrets - Secrets object to write
 * @param rootDir - Project root directory (defaults to findProjectRoot())
 */
export function writeSecretsFile(
  filename: string,
  secrets: SecretsFile,
  rootDir: string = findProjectRoot()
): void {
  const filePath = path.join(rootDir, filename);
  writeJsonFile(filePath, secrets);
}