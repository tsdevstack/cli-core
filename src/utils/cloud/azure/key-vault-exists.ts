/**
 * Check whether a secret scope's Key Vault exists
 */

import { KeyVaultManagementClient } from '@azure/arm-keyvault';
import { buildKeyVaultName } from './build-key-vault-name';
import { createAzureCredential } from './create-azure-credential';
import type { AzureCredentials } from '../types';

/**
 * Whether the vault of a secret scope exists. A service's vault is created
 * on the first write to its scope (or by infra:deploy), so reads check it
 * first: a missing vault holds no secrets, while a request to it fails on
 * DNS instead of a clean "not found".
 *
 * @param credentials - Azure credentials
 * @param projectName - Project name
 * @param env - Environment
 * @param scope - 'shared' (default) or a service name
 * @returns true when the vault exists
 */
export async function keyVaultExists(
  credentials: AzureCredentials,
  projectName: string,
  env: string,
  scope?: string,
): Promise<boolean> {
  const client = new KeyVaultManagementClient(
    createAzureCredential(credentials),
    credentials.subscriptionId,
  );

  try {
    await client.vaults.get(
      `${projectName}-${env}-rg`,
      buildKeyVaultName(projectName, env, scope),
    );
    return true;
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode === 404) {
      return false;
    }
    throw error;
  }
}
