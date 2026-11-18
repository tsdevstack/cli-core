import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { AzureCredentials } from '../types';

const mockVaultsGet = rs.fn();

rs.mock('./create-azure-credential', () => ({
  createAzureCredential: rs.fn(() => ({})),
}));

rs.mock('@azure/arm-keyvault', () => ({
  KeyVaultManagementClient: class {
    vaults = { get: mockVaultsGet };
  },
}));

import { resolveAzureNamingScheme } from './resolve-azure-naming-scheme';

// Each test uses its own project: the scheme is kept for the whole command
function credentials(subscriptionId: string): AzureCredentials {
  return {
    tenantId: 'tenant',
    clientId: 'client',
    clientSecret: 'secret',
    subscriptionId,
    location: 'eastus',
  };
}

describe('resolveAzureNamingScheme', () => {
  beforeEach(() => {
    rs.resetAllMocks();
  });

  describe('Standard use cases', () => {
    it('should keep the names of an environment whose shared vault has the old name', async () => {
      mockVaultsGet.mockResolvedValue({ name: 'shop-dev-kv' });

      await expect(
        resolveAzureNamingScheme(credentials('sub-1'), 'shop', 'dev'),
      ).resolves.toBe('legacy');
      expect(mockVaultsGet).toHaveBeenCalledWith('shop-dev-rg', 'shop-dev-kv');
    });

    it('should give a new environment unique names', async () => {
      mockVaultsGet.mockRejectedValue({ statusCode: 404 });

      await expect(
        resolveAzureNamingScheme(credentials('sub-2'), 'shop', 'dev'),
      ).resolves.toBe('unique');
    });

    it('should check once per environment for the whole command', async () => {
      mockVaultsGet.mockResolvedValue({ name: 'cart-dev-kv' });

      await resolveAzureNamingScheme(credentials('sub-3'), 'cart', 'dev');
      await resolveAzureNamingScheme(credentials('sub-3'), 'cart', 'dev');

      expect(mockVaultsGet).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge cases', () => {
    it('should stop, not guess, when the check fails', async () => {
      mockVaultsGet.mockRejectedValue(
        Object.assign(new Error('Forbidden'), { statusCode: 403 }),
      );

      await expect(
        resolveAzureNamingScheme(credentials('sub-4'), 'shop', 'dev'),
      ).rejects.toThrow(
        'Could not check for Key Vault shop-dev-kv in shop-dev-rg: Forbidden',
      );
    });

    it('should check again after a failed check', async () => {
      mockVaultsGet.mockRejectedValueOnce(
        Object.assign(new Error('timeout'), { statusCode: 500 }),
      );
      await expect(
        resolveAzureNamingScheme(credentials('sub-5'), 'shop', 'dev'),
      ).rejects.toThrow();

      mockVaultsGet.mockResolvedValue({ name: 'shop-dev-kv' });
      await expect(
        resolveAzureNamingScheme(credentials('sub-5'), 'shop', 'dev'),
      ).resolves.toBe('legacy');
    });
  });
});
