/**
 * Resolve an Azure environment's naming scheme
 */

import { KeyVaultManagementClient } from '@azure/arm-keyvault';
import { CliError } from '../../errors';
import { buildKeyVaultName } from './build-key-vault-name';
import { createAzureCredential } from './create-azure-credential';
import type { AzureCredentials, AzureNamingScheme } from '../types';

/** One check per environment for the whole command */
const schemes = new Map<string, Promise<AzureNamingScheme>>();

/**
 * Whether an environment keeps the names it was deployed with. The shared
 * Key Vault is the first resource tsdevstack creates in an environment
 * (cloud:init, cloud-secrets:push), before any Terraform state: an
 * environment set up with v0.12.0 or earlier has it under the old name
 * `{project}-{env}-kv`, in `{project}-{env}-rg`.
 *
 * - That vault exists: `legacy`, every name stays as it is.
 * - It doesn't (or the resource group doesn't): `unique`, names unique
 *   worldwide get the subscription's account suffix.
 * - The check fails otherwise: the command stops. A guess could create a
 *   second set of resources beside the deployed ones.
 *
 * @param credentials - The environment's Azure credentials
 * @param projectName - Project name from config.json
 * @param env - Environment
 * @returns The environment's naming scheme
 */
export function resolveAzureNamingScheme(
  credentials: AzureCredentials,
  projectName: string,
  env: string,
): Promise<AzureNamingScheme> {
  const key = `${credentials.subscriptionId}/${projectName}/${env}`;
  const known = schemes.get(key);
  if (known) {
    return known;
  }

  const resourceGroupName = `${projectName}-${env}-rg`;
  const legacyVaultName = buildKeyVaultName(projectName, env, {
    scheme: 'legacy',
    subscriptionId: credentials.subscriptionId,
  });
  const client = new KeyVaultManagementClient(
    createAzureCredential(credentials),
    credentials.subscriptionId,
  );

  const scheme = client.vaults
    .get(resourceGroupName, legacyVaultName)
    .then((): AzureNamingScheme => 'legacy')
    .catch((error: unknown): AzureNamingScheme => {
      if ((error as { statusCode?: number }).statusCode === 404) {
        return 'unique';
      }
      schemes.delete(key);
      throw new CliError(
        `Could not check for Key Vault ${legacyVaultName} in ${resourceGroupName}: ${error instanceof Error ? error.message : String(error)}`,
        'Azure naming',
        'The CLI checks for the shared Key Vault under its old name to keep the names this environment was deployed with, and stops rather than guess. Check that the service principal can read the resource group (Reader), then run the command again.',
      );
    });

  schemes.set(key, scheme);
  return scheme;
}
