/**
 * Ensure Key Vault exists, creating it if necessary
 *
 * Prerequisites: Resource group must already exist (created by user in Azure portal).
 * Uses RBAC authorization — the SP's "Key Vault Secrets Officer" role on the RG
 * is inherited by the Key Vault automatically.
 */

import { createAzureCredential } from './create-azure-credential';
import { KeyVaultManagementClient } from '@azure/arm-keyvault';
import type { VaultCreateOrUpdateParameters } from '@azure/arm-keyvault';
import { buildKeyVaultName } from './build-key-vault-name';
import { isSoftDeletedVaultConflict } from './is-soft-deleted-vault-conflict';
import { SHARED_SECRET_SCOPE } from '../../../constants';
import type { AzureCredentials } from '../types';

/**
 * Ensure the Key Vault of a secret scope exists: the shared vault (created
 * by cloud:init), or a service's own vault (created on the first write to
 * its scope, and by infra:deploy). A vault deleted within its soft-delete
 * retention is recovered, since its name stays reserved until then.
 *
 * @param projectName - Project name
 * @param env - Environment
 * @param azureCredentials - Azure credentials
 * @param scope - 'shared' (default) or a service name
 * @returns Whether the vault exists now, and whether this call created or recovered it
 */
export async function ensureKeyVaultExists(
  projectName: string,
  env: string,
  azureCredentials: AzureCredentials,
  scope?: string,
): Promise<{ exists: boolean; created: boolean; error?: string }> {
  try {
    const resourceGroupName = `${projectName}-${env}-rg`;
    const keyVaultName = buildKeyVaultName(projectName, env, scope);
    const location = azureCredentials.location;

    const credential = createAzureCredential(azureCredentials);
    const kvManagementClient = new KeyVaultManagementClient(
      credential,
      azureCredentials.subscriptionId,
    );

    // Check if Key Vault already exists
    try {
      await kvManagementClient.vaults.get(resourceGroupName, keyVaultName);
      return { exists: true, created: false };
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode !== 404) {
        throw error;
      }
    }

    // Create Key Vault with RBAC authorization
    const vaultParameters: VaultCreateOrUpdateParameters = {
      location,
      properties: {
        sku: {
          family: 'A' as const,
          name: 'standard' as const,
        },
        tenantId: azureCredentials.tenantId,
        accessPolicies: [],
        enabledForDeployment: false,
        enabledForDiskEncryption: false,
        enabledForTemplateDeployment: false,
        enableSoftDelete: true,
        softDeleteRetentionInDays: 90,
        enableRbacAuthorization: true,
      },
      tags: {
        'managed-by': 'tsdevstack',
        project: projectName,
        environment: env,
        scope: scope ?? SHARED_SECRET_SCOPE,
      },
    };

    try {
      await kvManagementClient.vaults.beginCreateOrUpdateAndWait(
        resourceGroupName,
        keyVaultName,
        vaultParameters,
      );
    } catch (error: unknown) {
      // A soft-deleted vault keeps its name reserved: recover it instead.
      // Looking it up first (vaults.getDeleted) needs a subscription-level
      // permission; the deployer's roles are on the resource group only.
      if (!isSoftDeletedVaultConflict(error)) {
        throw error;
      }
      await kvManagementClient.vaults.beginCreateOrUpdateAndWait(
        resourceGroupName,
        keyVaultName,
        {
          ...vaultParameters,
          properties: { ...vaultParameters.properties, createMode: 'recover' },
        },
      );
    }

    return { exists: true, created: true };
  } catch (error: unknown) {
    return {
      exists: false,
      created: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unknown error creating Key Vault',
    };
  }
}
