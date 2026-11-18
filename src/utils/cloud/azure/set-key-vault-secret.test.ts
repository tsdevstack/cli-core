import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { SecretClient } from '@azure/keyvault-secrets';
import { setKeyVaultSecret } from './set-key-vault-secret';

const mockSetSecret = rs.fn();
const mockPollUntilDone = rs.fn();
const mockBeginRecover = rs.fn();
const client = {
  setSecret: mockSetSecret,
  beginRecoverDeletedSecret: mockBeginRecover,
} as unknown as Pick<SecretClient, 'setSecret' | 'beginRecoverDeletedSecret'>;

const deletedConflict = Object.assign(
  new Error(
    'Secret tsdevstack-shared-DB-AUTH-PASSWORD is currently in a deleted but recoverable state, and its name cannot be reused; in this state, the secret can only be recovered or purged.',
  ),
  { statusCode: 409 },
);

describe('setKeyVaultSecret', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockSetSecret.mockResolvedValue({});
    mockPollUntilDone.mockResolvedValue({});
    mockBeginRecover.mockResolvedValue({ pollUntilDone: mockPollUntilDone });
  });

  describe('Standard use cases', () => {
    it('should write the secret with its options', async () => {
      const result = await setKeyVaultSecret(client, 'name', 'value', {
        tags: { scope: 'shared' },
      });

      expect(mockSetSecret).toHaveBeenCalledWith('name', 'value', {
        tags: { scope: 'shared' },
      });
      expect(mockBeginRecover).not.toHaveBeenCalled();
      expect(result).toEqual({ recovered: false });
    });

    it('should recover a deleted secret that holds the name, then write the value', async () => {
      mockSetSecret.mockRejectedValueOnce(deletedConflict);

      const result = await setKeyVaultSecret(client, 'name', 'value', {
        tags: { scope: 'shared' },
      });

      expect(mockBeginRecover).toHaveBeenCalledWith('name');
      expect(mockPollUntilDone).toHaveBeenCalled();
      expect(mockSetSecret).toHaveBeenCalledTimes(2);
      expect(mockSetSecret).toHaveBeenLastCalledWith('name', 'value', {
        tags: { scope: 'shared' },
      });
      expect(result).toEqual({ recovered: true });
    });

    it('should wait for the recovery before writing again', async () => {
      const order: string[] = [];
      mockSetSecret
        .mockRejectedValueOnce(deletedConflict)
        .mockImplementation(async () => {
          order.push('set');
        });
      mockPollUntilDone.mockImplementation(async () => {
        order.push('recovered');
      });

      await setKeyVaultSecret(client, 'name', 'value');

      expect(order).toEqual(['recovered', 'set']);
    });
  });

  describe('Edge cases', () => {
    it('should throw any other write error without recovering', async () => {
      const forbidden = Object.assign(new Error('Forbidden'), {
        statusCode: 403,
      });
      mockSetSecret.mockRejectedValueOnce(forbidden);

      await expect(setKeyVaultSecret(client, 'name', 'value')).rejects.toBe(
        forbidden,
      );
      expect(mockBeginRecover).not.toHaveBeenCalled();
    });

    it('should throw when the recovery fails', async () => {
      mockSetSecret.mockRejectedValueOnce(deletedConflict);
      mockPollUntilDone.mockRejectedValueOnce(new Error('recover failed'));

      await expect(setKeyVaultSecret(client, 'name', 'value')).rejects.toThrow(
        'recover failed',
      );
      expect(mockSetSecret).toHaveBeenCalledTimes(1);
    });
  });
});
