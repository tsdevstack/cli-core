/**
 * Get GCP credentials from environment variables (for CI)
 *
 * Supports multiple modes (in priority order):
 *
 * 1. WIF mode (google-github-actions/auth):
 *    - GOOGLE_APPLICATION_CREDENTIALS points to credentials file
 *    - Project ID from GOOGLE_CLOUD_PROJECT, GCLOUD_PROJECT, or CLOUDSDK_CORE_PROJECT
 *    - GCP_REGION required
 *
 * 2. Explicit ADC mode: GCP_PROJECT_ID, GCP_SERVICE_ACCOUNT, GCP_REGION
 *    - Used with Workload Identity Federation (WIF)
 *    - No private_key needed - ADC auto-discovers credentials
 *
 * 3. JSON key mode (legacy): GOOGLE_APPLICATION_CREDENTIALS_JSON, GCP_REGION
 *    - Used with service account key files
 *    - private_key included in credentials
 */

import fs from 'node:fs';
import type { GCPCredentials } from '../cloud/types';
import {
  GCP_CREDENTIALS_JSON,
  GCP_PROJECT_ID,
  GCP_REGION,
  GCP_SERVICE_ACCOUNT,
} from '../../constants/ci-env-vars';
import { CliError } from '../errors';

/**
 * Get project ID from standard Google Cloud env vars
 */
function getProjectIdFromEnv(): string | undefined {
  return (
    process.env[GCP_PROJECT_ID] ||
    process.env['GOOGLE_CLOUD_PROJECT'] ||
    process.env['GCLOUD_PROJECT'] ||
    process.env['CLOUDSDK_CORE_PROJECT']
  );
}

export function getGCPCredentialsFromEnv(): GCPCredentials {
  const region = process.env[GCP_REGION];
  const credentialsFile = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
  const credentialsJson = process.env[GCP_CREDENTIALS_JSON];

  // Mode 1: WIF via google-github-actions/auth (auto-discovery)
  // The auth action sets GOOGLE_APPLICATION_CREDENTIALS and project env vars
  if (credentialsFile && fs.existsSync(credentialsFile)) {
    const projectId = getProjectIdFromEnv();
    const serviceAccount = process.env[GCP_SERVICE_ACCOUNT];

    if (!region) {
      throw new CliError(
        'No GCP region found',
        'CI',
        `Set ${GCP_REGION} environment variable (e.g., us-central1)`
      );
    }

    // Try to read service account from credentials file if not explicitly set
    let clientEmail = serviceAccount;
    if (!clientEmail) {
      try {
        const creds = JSON.parse(fs.readFileSync(credentialsFile, 'utf-8'));
        clientEmail = creds.service_account_impersonation_url
          ? creds.service_account_impersonation_url.split('/').pop()?.replace(':generateAccessToken', '')
          : creds.client_email;
      } catch {
        // Ignore - will use projectId detection instead
      }
    }

    // Try to get project ID from credentials file if not in env
    let finalProjectId = projectId;
    if (!finalProjectId) {
      try {
        const creds = JSON.parse(fs.readFileSync(credentialsFile, 'utf-8'));
        finalProjectId = creds.quota_project_id || creds.project_id;
      } catch {
        // Ignore
      }
    }

    if (finalProjectId) {
      return {
        project_id: finalProjectId,
        client_email: clientEmail || `wif-service-account@${finalProjectId}.iam.gserviceaccount.com`,
        region,
      };
    }
  }

  // Mode 2: Explicit ADC mode (WIF): project ID + service account + region
  const projectId = process.env[GCP_PROJECT_ID];
  const serviceAccount = process.env[GCP_SERVICE_ACCOUNT];
  if (projectId && serviceAccount && region) {
    return {
      project_id: projectId,
      client_email: serviceAccount,
      // No private_key - ADC will handle authentication
      region,
    };
  }

  // Mode 3: JSON key mode (legacy): full credentials JSON + region
  if (credentialsJson) {
    if (!region) {
      throw new CliError(
        'No GCP region found',
        'CI',
        `Set ${GCP_REGION} environment variable (e.g., us-central1)`
      );
    }

    try {
      const parsed = JSON.parse(credentialsJson) as Omit<GCPCredentials, 'region'>;
      return {
        ...parsed,
        region,
      };
    } catch {
      throw new CliError(
        `Invalid ${GCP_CREDENTIALS_JSON}: must be valid JSON`,
        'CI',
        'Ensure the environment variable contains valid JSON'
      );
    }
  }

  // Neither mode configured
  throw new CliError(
    'No GCP credentials found',
    'CI',
    `Set either:\n` +
      `  - ADC mode (WIF): ${GCP_PROJECT_ID}, ${GCP_SERVICE_ACCOUNT}, ${GCP_REGION}\n` +
      `  - JSON key mode: ${GCP_CREDENTIALS_JSON}, ${GCP_REGION}`
  );
}