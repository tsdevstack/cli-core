import { describe, it, expect } from '@rstest/core';
import { isSoftDeletedVaultConflict } from './is-soft-deleted-vault-conflict';

describe('isSoftDeletedVaultConflict', () => {
  describe('Standard use cases', () => {
    it('should match the older soft-delete conflict wording', () => {
      expect(
        isSoftDeletedVaultConflict({
          statusCode: 409,
          code: 'ConflictError',
          message: 'Exist soft deleted vault with the same name.',
        }),
      ).toBe(true);
    });

    it('should match the newer soft-delete conflict wording', () => {
      expect(
        isSoftDeletedVaultConflict({
          statusCode: 409,
          message:
            'A vault with the same name already exists in deleted state.',
        }),
      ).toBe(true);
    });

    it('should match on the error code when the status is missing', () => {
      expect(
        isSoftDeletedVaultConflict({
          code: 'ConflictError',
          message: 'Exist soft deleted vault with the same name.',
        }),
      ).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should not match a conflict about a live vault', () => {
      expect(
        isSoftDeletedVaultConflict({
          statusCode: 409,
          code: 'VaultAlreadyExists',
          message: 'The vault name is already in use.',
        }),
      ).toBe(false);
    });

    it('should not match other statuses that mention deletion', () => {
      expect(
        isSoftDeletedVaultConflict({
          statusCode: 403,
          message: 'not authorized to read deletedVaults',
        }),
      ).toBe(false);
    });

    it('should not match non-objects', () => {
      expect(isSoftDeletedVaultConflict('deleted')).toBe(false);
      expect(isSoftDeletedVaultConflict(null)).toBe(false);
      expect(isSoftDeletedVaultConflict(undefined)).toBe(false);
    });
  });
});
