/**
 * CI/CD Environment Variable Constants
 *
 * Standard environment variable names used when running in CI.
 * These are the "normalized" names that CLI commands read from.
 * The GitHub workflow maps per-env secrets to these standard names.
 */

// Target environment
export const TARGET_ENV = 'TARGET_ENV';

// GCP credentials (JSON key mode - legacy)
export const GCP_CREDENTIALS_JSON = 'GOOGLE_APPLICATION_CREDENTIALS_JSON';

// GCP credentials (ADC mode - WIF preferred)
export const GCP_PROJECT_ID = 'GCP_PROJECT_ID';
export const GCP_REGION = 'GCP_REGION';
export const GCP_SERVICE_ACCOUNT = 'GCP_SERVICE_ACCOUNT';

// AWS credentials
export const AWS_ACCESS_KEY_ID = 'AWS_ACCESS_KEY_ID';
export const AWS_SECRET_ACCESS_KEY = 'AWS_SECRET_ACCESS_KEY';
export const AWS_SESSION_TOKEN = 'AWS_SESSION_TOKEN';
export const AWS_REGION = 'AWS_REGION';
export const AWS_ACCOUNT_ID = 'AWS_ACCOUNT_ID';

// Azure credentials
export const AZURE_CLIENT_ID = 'AZURE_CLIENT_ID';
export const AZURE_CLIENT_SECRET = 'AZURE_CLIENT_SECRET';
export const AZURE_TENANT_ID = 'AZURE_TENANT_ID';
export const AZURE_SUBSCRIPTION_ID = 'AZURE_SUBSCRIPTION_ID';
export const AZURE_LOCATION = 'AZURE_LOCATION';
