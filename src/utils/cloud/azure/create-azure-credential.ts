/**
 * Create the Azure credential for CLI SDK calls
 */

import {
  ClientSecretCredential,
  DefaultAzureCredential,
} from '@azure/identity';
import type { TokenCredential } from '@azure/identity';
import { isCIEnv } from '../../ci';
import { CliError } from '../../errors';
import type { AzureCredentials } from '../types';

/**
 * Credential for Azure SDK calls made by the CLI:
 * - CI (OIDC): DefaultAzureCredential picks up the azure/login session
 * - Local: the service principal from .credentials.azure.json
 *
 * @param credentials - Azure credentials of the environment
 * @returns TokenCredential for Azure SDK clients
 */
export function createAzureCredential(
  credentials: AzureCredentials,
): TokenCredential {
  if (isCIEnv()) {
    return new DefaultAzureCredential();
  }

  if (!credentials.clientSecret) {
    throw new CliError(
      'Azure client secret is required for local development',
      'credentials',
      'Ensure clientSecret is set in .tsdevstack/.credentials.azure.json',
    );
  }

  return new ClientSecretCredential(
    credentials.tenantId,
    credentials.clientId,
    credentials.clientSecret,
  );
}
