/**
 * Resolve the name of one of an environment's Key Vaults
 */

import { buildKeyVaultName } from './build-key-vault-name';
import { resolveAzureNamingScheme } from './resolve-azure-naming-scheme';
import type { AzureCredentials } from '../types';

/**
 * The vault's name in this environment: its naming scheme
 * (resolveAzureNamingScheme), then buildKeyVaultName.
 *
 * @param credentials - The environment's Azure credentials
 * @param projectName - Project name from config.json
 * @param env - Environment
 * @param scope - 'shared' (default) or a service name
 * @returns The vault name
 */
export async function resolveKeyVaultName(
  credentials: AzureCredentials,
  projectName: string,
  env: string,
  scope?: string,
): Promise<string> {
  const scheme = await resolveAzureNamingScheme(credentials, projectName, env);
  return buildKeyVaultName(
    projectName,
    env,
    { scheme, subscriptionId: credentials.subscriptionId },
    scope,
  );
}
