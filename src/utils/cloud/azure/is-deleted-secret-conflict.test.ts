import { describe, it, expect } from '@rstest/core';
import { isDeletedSecretConflict } from './is-deleted-secret-conflict';

describe('isDeletedSecretConflict', () => {
  describe('Standard use cases', () => {
    it("should recognize Azure's answer for a name held by a deleted secret", () => {
      const error = Object.assign(
        new Error(
          'Secret tsdevstack-auth-service-BCRYPT-ROUNDS is currently in a deleted but recoverable state, and its name cannot be reused; in this state, the secret can only be recovered or purged.',
        ),
        { statusCode: 409, code: 'Conflict' },
      );

      expect(isDeletedSecretConflict(error)).toBe(true);
    });

    it('should recognize the inner error code in the message', () => {
      const error = Object.assign(
        new Error('Conflict (ObjectIsDeletedButRecoverable)'),
        { statusCode: 409 },
      );

      expect(isDeletedSecretConflict(error)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should not take another conflict for it', () => {
      const error = Object.assign(new Error('Operation is in progress'), {
        statusCode: 409,
      });

      expect(isDeletedSecretConflict(error)).toBe(false);
    });

    it('should not take another status with the same words for it', () => {
      const error = Object.assign(
        new Error('Secret is currently in a deleted but recoverable state'),
        { statusCode: 403 },
      );

      expect(isDeletedSecretConflict(error)).toBe(false);
    });

    it('should return false for values that are not errors', () => {
      expect(isDeletedSecretConflict(undefined)).toBe(false);
      expect(isDeletedSecretConflict(null)).toBe(false);
      expect(isDeletedSecretConflict('deleted but recoverable')).toBe(false);
    });
  });
});
