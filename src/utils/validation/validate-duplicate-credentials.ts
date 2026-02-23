import { CliError } from '../errors';
import type {
  CloudProvider,
  GCPCredentials,
  AWSCredentials,
  AzureCredentials,
} from '../../plugin/types';

/**
 * Validates that credentials are unique across environments.
 * Checks for duplicate project_id (GCP), accountId (AWS), or subscriptionId (Azure).
 *
 * @param allCredentials - Object with environment names as keys and credentials as values
 * @param provider - The cloud provider being validated
 * @throws {CliError} If duplicate credentials are detected
 */
export function validateDuplicateCredentials(
  allCredentials: Record<string, unknown>,
  provider: CloudProvider,
): void {
  const environments = Object.keys(allCredentials);

  if (environments.length < 2) {
    return;
  }

  const seenValues = new Map<string, string[]>();

  let fieldName: string;
  let getFieldValue: (creds: unknown) => string | undefined;

  switch (provider) {
    case 'gcp':
      fieldName = 'project_id';
      getFieldValue = (creds) => (creds as GCPCredentials).project_id;
      break;
    case 'aws':
      fieldName = 'accountId';
      getFieldValue = (creds) => (creds as AWSCredentials).accountId;
      break;
    case 'azure':
      fieldName = 'subscriptionId';
      getFieldValue = (creds) => (creds as AzureCredentials).subscriptionId;
      break;
    default:
      return;
  }

  for (const env of environments) {
    const credentials = allCredentials[env];
    const value = getFieldValue(credentials);

    if (!value) {
      continue;
    }

    if (!seenValues.has(value)) {
      seenValues.set(value, []);
    }
    seenValues.get(value)!.push(env);
  }

  const duplicates: string[] = [];
  seenValues.forEach((envs, value) => {
    if (envs.length > 1) {
      duplicates.push(
        `${fieldName} "${value}" is used by environments: ${envs.join(', ')}`,
      );
    }
  });

  if (duplicates.length > 0) {
    const providerName = provider.toUpperCase();
    throw new CliError(
      `Duplicate ${providerName} credentials detected:\n  - ${duplicates.join('\n  - ')}`,
      'Environment Isolation Error',
      `Each environment must use separate ${
        provider === 'gcp'
          ? 'GCP projects'
          : provider === 'aws'
            ? 'AWS accounts'
            : 'Azure subscriptions'
      }.\n` +
        `See: https://tsdevstack.dev/infrastructure/environments#environment-isolation`,
    );
  }
}
