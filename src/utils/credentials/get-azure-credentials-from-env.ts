/**
 * Get Azure credentials from environment variables (for CI)
 *
 * Uses OIDC federation with azure/login action:
 *   - AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID set by workflow
 *   - AZURE_CLIENT_SECRET optional (not needed with OIDC)
 *   - AZURE_LOCATION for region
 */

import type { AzureCredentials } from '../cloud/types';
import {
  AZURE_CLIENT_ID,
  AZURE_CLIENT_SECRET,
  AZURE_TENANT_ID,
  AZURE_SUBSCRIPTION_ID,
  AZURE_LOCATION,
} from '../../constants/ci-env-vars';
import { CliError } from '../errors';

export function getAzureCredentialsFromEnv(): AzureCredentials {
  const clientId = process.env[AZURE_CLIENT_ID];
  const clientSecret = process.env[AZURE_CLIENT_SECRET];
  const tenantId = process.env[AZURE_TENANT_ID];
  const subscriptionId = process.env[AZURE_SUBSCRIPTION_ID];
  const location = process.env[AZURE_LOCATION];

  if (!clientId) {
    throw new CliError(
      'No Azure client ID found',
      'CI',
      `Set ${AZURE_CLIENT_ID} environment variable\n` +
        'For GitHub Actions OIDC, use azure/login action',
    );
  }

  if (!tenantId) {
    throw new CliError(
      'No Azure tenant ID found',
      'CI',
      `Set ${AZURE_TENANT_ID} environment variable`,
    );
  }

  if (!subscriptionId) {
    throw new CliError(
      'No Azure subscription ID found',
      'CI',
      `Set ${AZURE_SUBSCRIPTION_ID} environment variable`,
    );
  }

  if (!location) {
    throw new CliError(
      'No Azure location found',
      'CI',
      `Set ${AZURE_LOCATION} environment variable (e.g., eastus)`,
    );
  }

  return {
    clientId,
    ...(clientSecret && { clientSecret }),
    tenantId,
    subscriptionId,
    location,
  };
}
