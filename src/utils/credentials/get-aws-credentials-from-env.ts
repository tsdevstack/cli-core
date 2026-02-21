/**
 * Get AWS credentials from environment variables (for CI)
 *
 * Supports two modes:
 *
 * 1. OIDC mode (aws-actions/configure-aws-credentials):
 *    - AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY set by action
 *    - AWS_SESSION_TOKEN for temporary credentials
 *    - AWS_REGION or AWS_DEFAULT_REGION
 *    - AWS_ACCOUNT_ID optional (for validation)
 *
 * 2. Direct credentials mode (legacy):
 *    - AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *    - AWS_REGION
 *    - AWS_ACCOUNT_ID required
 */

import type { AWSCredentials } from '../cloud/types';
import {
  AWS_ACCESS_KEY_ID,
  AWS_REGION,
  AWS_SECRET_ACCESS_KEY,
  AWS_SESSION_TOKEN,
  AWS_ACCOUNT_ID,
} from '../../constants/ci-env-vars';
import { CliError } from '../errors';

export function getAWSCredentialsFromEnv(): AWSCredentials {
  const accessKeyId = process.env[AWS_ACCESS_KEY_ID];
  const secretAccessKey = process.env[AWS_SECRET_ACCESS_KEY];
  const sessionToken = process.env[AWS_SESSION_TOKEN];
  const region = process.env[AWS_REGION] || process.env['AWS_DEFAULT_REGION'];
  const accountId = process.env[AWS_ACCOUNT_ID];

  // Validate required credentials
  if (!accessKeyId) {
    throw new CliError(
      'No AWS access key found',
      'CI',
      `Set ${AWS_ACCESS_KEY_ID} environment variable\n` +
        'For GitHub Actions OIDC, use aws-actions/configure-aws-credentials',
    );
  }

  if (!secretAccessKey) {
    throw new CliError(
      'No AWS secret access key found',
      'CI',
      `Set ${AWS_SECRET_ACCESS_KEY} environment variable\n` +
        'For GitHub Actions OIDC, use aws-actions/configure-aws-credentials',
    );
  }

  if (!region) {
    throw new CliError(
      'No AWS region found',
      'CI',
      `Set ${AWS_REGION} or AWS_DEFAULT_REGION environment variable (e.g., us-east-1)`,
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    region,
    // Account ID is optional in CI - can be empty string
    // The deploy commands will get it from STS if needed
    accountId: accountId || '',
    // Session token is present with OIDC/STS temporary credentials
    ...(sessionToken ? { sessionToken } : {}),
  };
}
