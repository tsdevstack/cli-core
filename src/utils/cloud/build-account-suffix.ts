/**
 * Build the account suffix for names that must be unique worldwide
 */

import { createHash } from 'crypto';
import { ACCOUNT_SUFFIX_LENGTH } from '../../constants';

/**
 * The first characters of the SHA-256 of the account ID (Azure subscription
 * ID), in lowercase hex. The same as infra-core's buildAccountSuffix, which
 * names the other Azure resources; both are pinned by the same test values.
 *
 * @param accountId - Azure subscription ID
 * @returns The suffix, without a separator
 */
export function buildAccountSuffix(accountId: string): string {
  return createHash('sha256')
    .update(accountId)
    .digest('hex')
    .slice(0, ACCOUNT_SUFFIX_LENGTH);
}
