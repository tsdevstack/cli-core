/**
 * Build the Key Vault name for a secret scope
 */

import { createHash } from 'crypto';
import {
  AZURE_KEY_VAULT_NAME_HASH_LENGTH,
  AZURE_KEY_VAULT_NAME_MAX_LENGTH,
  AZURE_SHARED_KEY_VAULT_SUFFIX,
  SHARED_SECRET_SCOPE,
} from '../../../constants';

/**
 * The Key Vault that holds one secret scope of an environment: the shared
 * scope in `{project}-{env}-kv`, a service's scope in
 * `{project}-{env}-{service}`. A name longer than 24 characters becomes a
 * trimmed prefix plus an 8-character hash of the full name, so it stays
 * unique and the same everywhere it is computed (cloud-secrets, deploy,
 * Terraform, the runtime env vars).
 *
 * Key Vault names allow letters, digits and single hyphens, start with a
 * letter and end with a letter or digit.
 *
 * @param projectName - Project name from config.json
 * @param env - Environment (dev, staging, prod, ...)
 * @param scope - 'shared' (default) or a service name
 * @returns The vault name
 */
export function buildKeyVaultName(
  projectName: string,
  env: string,
  scope: string = SHARED_SECRET_SCOPE,
): string {
  const suffix =
    scope === SHARED_SECRET_SCOPE ? AZURE_SHARED_KEY_VAULT_SUFFIX : scope;
  const name = `${projectName}-${env}-${suffix}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');

  if (name.length <= AZURE_KEY_VAULT_NAME_MAX_LENGTH) {
    return name;
  }

  const hash = createHash('sha256')
    .update(name)
    .digest('hex')
    .slice(0, AZURE_KEY_VAULT_NAME_HASH_LENGTH);
  const prefix = name
    .slice(
      0,
      AZURE_KEY_VAULT_NAME_MAX_LENGTH - AZURE_KEY_VAULT_NAME_HASH_LENGTH - 1,
    )
    .replace(/-+$/, '');
  return `${prefix}-${hash}`;
}
