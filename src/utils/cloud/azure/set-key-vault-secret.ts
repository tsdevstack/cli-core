/**
 * Write a secret to Azure Key Vault, taking back a name a deleted secret holds
 */

import type { SecretClient, SetSecretOptions } from '@azure/keyvault-secrets';
import { isDeletedSecretConflict } from './is-deleted-secret-conflict';

/**
 * Sets the secret. When a deleted secret holds the name (soft delete: after
 * remove-service, cloud-secrets:remove or a delete in the portal), recovers
 * it and sets the value again, as Terraform's azurerm provider does by
 * default. The recovered secret's old versions come back in its history;
 * the value written here becomes the current one.
 *
 * @param client - The vault's client
 * @param name - The secret's name in Key Vault (hyphens, no underscores)
 * @param value - The value to write
 * @param options - Tags and the like, as for setSecret
 * @returns Whether a deleted secret was recovered first
 * @throws The SDK's error for any other failure
 */
export async function setKeyVaultSecret(
  client: Pick<SecretClient, 'setSecret' | 'beginRecoverDeletedSecret'>,
  name: string,
  value: string,
  options?: SetSecretOptions,
): Promise<{ recovered: boolean }> {
  try {
    await client.setSecret(name, value, options);
    return { recovered: false };
  } catch (error: unknown) {
    if (!isDeletedSecretConflict(error)) {
      throw error;
    }
  }

  const recovery = await client.beginRecoverDeletedSecret(name);
  await recovery.pollUntilDone();
  await client.setSecret(name, value, options);
  return { recovered: true };
}
