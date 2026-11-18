/**
 * Cloud Provider Types
 *
 * Credential and configuration types for cloud providers.
 */

export type CloudProvider = 'gcp' | 'aws' | 'azure';

export interface GCPCredentials {
  project_id: string;
  client_email: string;
  /** Optional in ADC mode (WIF). Present when using service account key. */
  private_key?: string;
  region: string;
}

/**
 * Options for Google Cloud client initialization
 *
 * Supports two modes:
 * - Explicit credentials (local): Include credentials object
 * - ADC (CI with WIF): Only projectId, SDK auto-discovers credentials
 *
 * Index signature allows compatibility with Google Cloud SDK ClientOptions
 */
export interface GCPClientOptions {
  projectId: string;
  credentials?: {
    client_email: string;
    private_key: string;
  };
  [key: string]: string | number | object | undefined;
}

export interface AWSCredentials {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  /** Temporary session token (present with OIDC/STS credentials) */
  sessionToken?: string;
}

export interface AzureCredentials {
  clientId: string;
  /** Optional — not needed in CI (OIDC via azure/login) */
  clientSecret?: string;
  tenantId: string;
  subscriptionId: string;
  location: string;
}

/**
 * How an Azure environment names the resources whose names are unique
 * worldwide: `legacy` (deployed with v0.12.0 or earlier, keeps every name)
 * or `unique` (the subscription's account suffix). See
 * resolveAzureNamingScheme.
 */
export type AzureNamingScheme = 'legacy' | 'unique';

/** What a Key Vault name needs besides the project, environment and scope */
export interface AzureNaming {
  scheme: AzureNamingScheme;
  subscriptionId: string;
}
