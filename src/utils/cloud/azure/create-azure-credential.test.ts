import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { isCIEnv, DefaultAzureCredential, ClientSecretCredential } = rs.hoisted(
  () => ({
    isCIEnv: rs.fn(),
    DefaultAzureCredential: rs.fn(),
    ClientSecretCredential: rs.fn(),
  }),
);

rs.mock('../../ci', () => ({ isCIEnv }));
rs.mock('@azure/identity', () => ({
  DefaultAzureCredential,
  ClientSecretCredential,
}));

import { createAzureCredential } from './create-azure-credential';
import { CliError } from '../../errors';
import type { AzureCredentials } from '../types';

const credentials: AzureCredentials = {
  clientId: 'client',
  clientSecret: 'secret',
  tenantId: 'tenant',
  subscriptionId: 'subscription',
  location: 'eastus',
};

describe('createAzureCredential', () => {
  beforeEach(() => {
    rs.resetAllMocks();
  });

  it('should use DefaultAzureCredential in CI (OIDC login)', () => {
    isCIEnv.mockReturnValue(true);

    createAzureCredential(credentials);

    expect(DefaultAzureCredential).toHaveBeenCalled();
    expect(ClientSecretCredential).not.toHaveBeenCalled();
  });

  it('should not require a client secret in CI', () => {
    isCIEnv.mockReturnValue(true);

    expect(() =>
      createAzureCredential({ ...credentials, clientSecret: '' }),
    ).not.toThrow();
  });

  it('should use the service principal locally', () => {
    isCIEnv.mockReturnValue(false);

    createAzureCredential(credentials);

    expect(ClientSecretCredential).toHaveBeenCalledWith(
      'tenant',
      'client',
      'secret',
    );
  });

  it('should require a client secret locally', () => {
    isCIEnv.mockReturnValue(false);

    expect(() =>
      createAzureCredential({ ...credentials, clientSecret: '' }),
    ).toThrow(CliError);
  });
});
