/**
 * Whether a Key Vault secret write failed because a deleted secret holds the
 * name. Soft delete keeps a deleted secret recoverable for the vault's
 * retention (90 days for the framework's vaults), and until it is recovered
 * or purged, Azure refuses the name with 409: "Secret ... is currently in a
 * deleted but recoverable state, and its name cannot be reused" (inner code
 * ObjectIsDeletedButRecoverable).
 *
 * @param error - The error the write threw
 * @returns true when the name is held by a deleted secret
 */
export function isDeletedSecretConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const { statusCode, message } = error as {
    statusCode?: unknown;
    message?: unknown;
  };

  return (
    statusCode === 409 &&
    typeof message === 'string' &&
    /deleted but recoverable|ObjectIsDeletedButRecoverable/i.test(message)
  );
}
