import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { AzureCredentials } from '../types';

const mockVaultsGet = rs.fn();
const mockVaultsBeginCreateOrUpdateAndWait = rs.fn();

rs.mock('./create-azure-credential', () => ({
  createAzureCredential: rs.fn(() => ({})),
}));

// The environment's scheme is checked once per command (its own test)
rs.mock('./resolve-azure-naming-scheme', () => ({
  resolveAzureNamingScheme: rs.fn(async () => 'legacy'),
}));

rs.mock('@azure/arm-keyvault', () => {
  return {
    KeyVaultManagementClient: class MockKeyVaultManagementClient {
      vaults = {
        get: mockVaultsGet,
        beginCreateOrUpdateAndWait: mockVaultsBeginCreateOrUpdateAndWait,
      };
      constructor() {}
    },
  };
});

import { ensureKeyVaultExists } from './ensure-key-vault-exists';
import { buildKeyVaultName } from './build-key-vault-name';

const AUTH_VAULT = buildKeyVaultName(
  'myproject',
  'dev',
  { scheme: 'legacy', subscriptionId: 'test-subscription-id' },
  'auth-service',
);

describe('ensureKeyVaultExists', () => {
  beforeEach(() => {
    rs.resetAllMocks();
  });

  const mockCredentials: AzureCredentials = {
    tenantId: 'test-tenant-id',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    subscriptionId: 'test-subscription-id',
    location: 'eastus',
  };

  it('should return exists=true, created=false when Key Vault already exists', async () => {
    mockVaultsGet.mockResolvedValue({ name: 'myproject-dev-kv' });

    const result = await ensureKeyVaultExists(
      'myproject',
      'dev',
      mockCredentials,
    );

    expect(result).toEqual({ exists: true, created: false });
    expect(mockVaultsGet).toHaveBeenCalledWith(
      'myproject-dev-rg',
      'myproject-dev-kv',
    );
    expect(mockVaultsBeginCreateOrUpdateAndWait).not.toHaveBeenCalled();
  });

  it('should create Key Vault with RBAC authorization when it does not exist', async () => {
    mockVaultsGet.mockRejectedValue({ statusCode: 404 });
    mockVaultsBeginCreateOrUpdateAndWait.mockResolvedValue({});

    const result = await ensureKeyVaultExists(
      'myproject',
      'dev',
      mockCredentials,
    );

    expect(result).toEqual({ exists: true, created: true });
    expect(mockVaultsBeginCreateOrUpdateAndWait).toHaveBeenCalledWith(
      'myproject-dev-rg',
      'myproject-dev-kv',
      expect.objectContaining({
        location: 'eastus',
        properties: expect.objectContaining({
          tenantId: 'test-tenant-id',
          enableRbacAuthorization: true,
          accessPolicies: [],
        }),
        tags: expect.objectContaining({
          'managed-by': 'tsdevstack',
          project: 'myproject',
          environment: 'dev',
        }),
      }),
    );
  });

  it('should return error when Key Vault get fails with non-404 error', async () => {
    const error = new Error('Permission denied');
    (error as Error & { statusCode: number }).statusCode = 403;
    mockVaultsGet.mockRejectedValue(error);

    const result = await ensureKeyVaultExists(
      'myproject',
      'dev',
      mockCredentials,
    );

    expect(result.exists).toBe(false);
    expect(result.created).toBe(false);
    expect(result.error).toBe('Permission denied');
  });

  it('should return error when Key Vault creation fails', async () => {
    mockVaultsGet.mockRejectedValue({ statusCode: 404 });
    mockVaultsBeginCreateOrUpdateAndWait.mockRejectedValue(
      new Error('Quota exceeded'),
    );

    const result = await ensureKeyVaultExists(
      'myproject',
      'dev',
      mockCredentials,
    );

    expect(result.exists).toBe(false);
    expect(result.created).toBe(false);
    expect(result.error).toBe('Quota exceeded');
  });

  it("should create a service's vault under its own name", async () => {
    mockVaultsGet.mockRejectedValue({ statusCode: 404 });
    mockVaultsBeginCreateOrUpdateAndWait.mockResolvedValue({});

    const result = await ensureKeyVaultExists(
      'myproject',
      'dev',
      mockCredentials,
      'auth-service',
    );

    expect(result).toEqual({ exists: true, created: true });
    expect(mockVaultsBeginCreateOrUpdateAndWait).toHaveBeenCalledWith(
      'myproject-dev-rg',
      AUTH_VAULT,
      expect.objectContaining({
        tags: expect.objectContaining({ scope: 'auth-service' }),
      }),
    );
  });

  it('should recover a soft-deleted vault when its name is held', async () => {
    mockVaultsGet.mockRejectedValue({ statusCode: 404 });
    mockVaultsBeginCreateOrUpdateAndWait
      .mockRejectedValueOnce({
        statusCode: 409,
        code: 'ConflictError',
        message: 'Exist soft deleted vault with the same name.',
      })
      .mockResolvedValueOnce({});

    const result = await ensureKeyVaultExists(
      'myproject',
      'dev',
      mockCredentials,
      'auth-service',
    );

    expect(result).toEqual({ exists: true, created: true });
    expect(mockVaultsBeginCreateOrUpdateAndWait).toHaveBeenCalledTimes(2);
    expect(mockVaultsBeginCreateOrUpdateAndWait).toHaveBeenLastCalledWith(
      'myproject-dev-rg',
      AUTH_VAULT,
      expect.objectContaining({
        properties: expect.objectContaining({
          createMode: 'recover',
          enableRbacAuthorization: true,
        }),
      }),
    );
  });

  it('should not recover on a conflict that is not about a deleted vault', async () => {
    mockVaultsGet.mockRejectedValue({ statusCode: 404 });
    const conflict = new Error('The vault name is already in use.');
    (conflict as Error & { statusCode: number }).statusCode = 409;
    mockVaultsBeginCreateOrUpdateAndWait.mockRejectedValue(conflict);

    const result = await ensureKeyVaultExists(
      'myproject',
      'dev',
      mockCredentials,
    );

    expect(result.exists).toBe(false);
    expect(result.error).toBe('The vault name is already in use.');
    expect(mockVaultsBeginCreateOrUpdateAndWait).toHaveBeenCalledTimes(1);
  });

  it('should return the error when recovering fails', async () => {
    mockVaultsGet.mockRejectedValue({ statusCode: 404 });
    mockVaultsBeginCreateOrUpdateAndWait
      .mockRejectedValueOnce({
        statusCode: 409,
        message: 'A vault with the same name already exists in deleted state.',
      })
      .mockRejectedValueOnce(new Error('Recover denied'));

    const result = await ensureKeyVaultExists(
      'myproject',
      'dev',
      mockCredentials,
    );

    expect(result.exists).toBe(false);
    expect(result.created).toBe(false);
    expect(result.error).toBe('Recover denied');
  });

  it('should not recover when creating a vault that was never deleted', async () => {
    mockVaultsGet.mockRejectedValue({ statusCode: 404 });
    mockVaultsBeginCreateOrUpdateAndWait.mockResolvedValue({});

    await ensureKeyVaultExists('myproject', 'dev', mockCredentials);

    const parameters = mockVaultsBeginCreateOrUpdateAndWait.mock
      .calls[0][2] as {
      properties: Record<string, unknown>;
    };
    expect(parameters.properties.createMode).toBeUndefined();
  });

  it('should create a new vault once for calls made at the same time', async () => {
    mockVaultsGet.mockRejectedValue({ statusCode: 404 });
    let finishCreate: () => void = () => {};
    mockVaultsBeginCreateOrUpdateAndWait.mockReturnValue(
      new Promise<void>((resolve) => {
        finishCreate = resolve;
      }),
    );

    const calls = Array.from({ length: 5 }, () =>
      ensureKeyVaultExists('myproject', 'dev', mockCredentials, 'auth-service'),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    finishCreate();
    const results = await Promise.all(calls);

    expect(mockVaultsBeginCreateOrUpdateAndWait).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual({ exists: true, created: true });
    expect(results.slice(1)).toEqual(
      Array(4).fill({ exists: true, created: false }),
    );
  });

  it('should give every waiting call the error of the create they shared', async () => {
    mockVaultsGet.mockRejectedValue({ statusCode: 404 });
    mockVaultsBeginCreateOrUpdateAndWait.mockRejectedValue(
      new Error('Forbidden'),
    );

    const results = await Promise.all([
      ensureKeyVaultExists('myproject', 'dev', mockCredentials, 'auth-service'),
      ensureKeyVaultExists('myproject', 'dev', mockCredentials, 'auth-service'),
    ]);

    expect(mockVaultsBeginCreateOrUpdateAndWait).toHaveBeenCalledTimes(1);
    for (const result of results) {
      expect(result).toEqual({
        exists: false,
        created: false,
        error: 'Forbidden',
      });
    }
  });

  it('should check again on a later call, once the earlier one ended', async () => {
    mockVaultsGet.mockResolvedValue({ name: AUTH_VAULT });

    await ensureKeyVaultExists(
      'myproject',
      'dev',
      mockCredentials,
      'auth-service',
    );
    await ensureKeyVaultExists(
      'myproject',
      'dev',
      mockCredentials,
      'auth-service',
    );

    expect(mockVaultsGet).toHaveBeenCalledTimes(2);
  });

  it('should not make different vaults wait for each other', async () => {
    mockVaultsGet.mockRejectedValue({ statusCode: 404 });
    mockVaultsBeginCreateOrUpdateAndWait.mockResolvedValue({});

    await Promise.all([
      ensureKeyVaultExists('myproject', 'dev', mockCredentials, 'auth-service'),
      ensureKeyVaultExists(
        'myproject',
        'dev',
        mockCredentials,
        'offers-service',
      ),
    ]);

    expect(mockVaultsBeginCreateOrUpdateAndWait).toHaveBeenCalledTimes(2);
  });

  it('should handle non-Error exceptions', async () => {
    mockVaultsGet.mockRejectedValue({ statusCode: 404 });
    mockVaultsBeginCreateOrUpdateAndWait.mockRejectedValue('string error');

    const result = await ensureKeyVaultExists(
      'myproject',
      'dev',
      mockCredentials,
    );

    expect(result.error).toBe('Unknown error creating Key Vault');
  });
});
