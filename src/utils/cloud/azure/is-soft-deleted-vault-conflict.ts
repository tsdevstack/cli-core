/**
 * Whether a Key Vault create failed because a soft-deleted vault holds the
 * name. Azure answers 409 ConflictError, with wording that varies:
 * "Exist soft deleted vault with the same name." or "A vault with the same
 * name already exists in deleted state."
 *
 * @param error - The error the create threw
 * @returns true when the name is held by a soft-deleted vault
 */
export function isSoftDeletedVaultConflict(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const { statusCode, code, message } = error as {
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
  };

  const isConflict = statusCode === 409 || code === 'ConflictError';
  return isConflict && typeof message === 'string' && /deleted/i.test(message);
}
