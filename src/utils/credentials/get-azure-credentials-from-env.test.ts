import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';
import { getAzureCredentialsFromEnv } from './get-azure-credentials-from-env';

describe('getAzureCredentialsFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    rs.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Standard use cases', () => {
    it('should return credentials from environment variables', () => {
      process.env.AZURE_CLIENT_ID = 'test-client-id';
      process.env.AZURE_CLIENT_SECRET = 'test-client-secret';
      process.env.AZURE_TENANT_ID = 'test-tenant-id';
      process.env.AZURE_SUBSCRIPTION_ID = 'test-subscription-id';
      process.env.AZURE_LOCATION = 'eastus';

      const result = getAzureCredentialsFromEnv();

      expect(result).toEqual({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        tenantId: 'test-tenant-id',
        subscriptionId: 'test-subscription-id',
        location: 'eastus',
      });
    });
  });

  describe('Error handling', () => {
    it('should throw when AZURE_CLIENT_ID is missing', () => {
      process.env.AZURE_CLIENT_SECRET = 'test-client-secret';
      process.env.AZURE_TENANT_ID = 'test-tenant-id';
      process.env.AZURE_SUBSCRIPTION_ID = 'test-subscription-id';
      process.env.AZURE_LOCATION = 'eastus';

      expect(() => getAzureCredentialsFromEnv()).toThrow(
        'No Azure client ID found',
      );
    });

    it('should return credentials without clientSecret (OIDC mode)', () => {
      process.env.AZURE_CLIENT_ID = 'test-client-id';
      process.env.AZURE_TENANT_ID = 'test-tenant-id';
      process.env.AZURE_SUBSCRIPTION_ID = 'test-subscription-id';
      process.env.AZURE_LOCATION = 'eastus';

      const result = getAzureCredentialsFromEnv();

      expect(result).toEqual({
        clientId: 'test-client-id',
        tenantId: 'test-tenant-id',
        subscriptionId: 'test-subscription-id',
        location: 'eastus',
      });
      expect(result.clientSecret).toBeUndefined();
    });

    it('should throw when AZURE_TENANT_ID is missing', () => {
      process.env.AZURE_CLIENT_ID = 'test-client-id';
      process.env.AZURE_CLIENT_SECRET = 'test-client-secret';
      process.env.AZURE_SUBSCRIPTION_ID = 'test-subscription-id';
      process.env.AZURE_LOCATION = 'eastus';

      expect(() => getAzureCredentialsFromEnv()).toThrow(
        'No Azure tenant ID found',
      );
    });

    it('should throw when AZURE_SUBSCRIPTION_ID is missing', () => {
      process.env.AZURE_CLIENT_ID = 'test-client-id';
      process.env.AZURE_CLIENT_SECRET = 'test-client-secret';
      process.env.AZURE_TENANT_ID = 'test-tenant-id';
      process.env.AZURE_LOCATION = 'eastus';

      expect(() => getAzureCredentialsFromEnv()).toThrow(
        'No Azure subscription ID found',
      );
    });

    it('should throw when AZURE_LOCATION is missing', () => {
      process.env.AZURE_CLIENT_ID = 'test-client-id';
      process.env.AZURE_CLIENT_SECRET = 'test-client-secret';
      process.env.AZURE_TENANT_ID = 'test-tenant-id';
      process.env.AZURE_SUBSCRIPTION_ID = 'test-subscription-id';

      expect(() => getAzureCredentialsFromEnv()).toThrow(
        'No Azure location found',
      );
    });
  });
});
