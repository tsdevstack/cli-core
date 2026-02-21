/**
 * Load secrets for a specific service from .secrets.local.json
 *
 * @param serviceName - Name of the service
 * @returns Service secrets object, or null if not found
 */

import * as path from 'path';
import { readJsonFile } from '../fs';
import { findProjectRoot } from '../paths';
import { LOCAL_SECRETS_FILE } from '../../constants';
import type { SecretsFile } from './types';

export function loadServiceSecrets(
  serviceName: string,
): Record<string, unknown> | null {
  const rootDir = findProjectRoot();
  const secretsPath = path.join(rootDir, LOCAL_SECRETS_FILE);

  let secretsFile: SecretsFile;
  try {
    secretsFile = readJsonFile<SecretsFile>(secretsPath);
  } catch {
    return null;
  }

  const serviceSecrets = secretsFile[serviceName];

  if (!serviceSecrets || typeof serviceSecrets !== 'object' || Array.isArray(serviceSecrets)) {
    return null;
  }

  return serviceSecrets as Record<string, unknown>;
}
