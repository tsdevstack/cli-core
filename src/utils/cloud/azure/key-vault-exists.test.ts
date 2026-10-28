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

import { keyVaultExists } from './key-vault-exists';

describe('keyVaultExists', () => {
  const credentials: AzureCredentials = {
    tenantId: 'tenant',
    clientId: 'client',
    clientSecret: 'secret',
    subscriptionId: 'subscription',
    location: 'eastus',
  };

  beforeEach(() => {
    rs.resetAllMocks();
  });

  it("should check the scope's vault in the environment's resource group", async () => {
    mockVaultsGet.mockResolvedValue({ name: 'shop-dev-auth-service' });

    await expect(
      keyVaultExists(credentials, 'shop', 'dev', 'auth-service'),
    ).resolves.toBe(true);
    expect(mockVaultsGet).toHaveBeenCalledWith(
      'shop-dev-rg',
      'shop-dev-auth-service',
    );
  });

  it('should return false for a vault that does not exist', async () => {
    mockVaultsGet.mockRejectedValue({ statusCode: 404 });

    await expect(
      keyVaultExists(credentials, 'shop', 'dev', 'offers-service'),
    ).resolves.toBe(false);
  });

  it('should throw other errors', async () => {
    mockVaultsGet.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { statusCode: 403 }),
    );

    await expect(keyVaultExists(credentials, 'shop', 'dev')).rejects.toThrow(
      'Forbidden',
    );
  });
});
