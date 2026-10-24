/**
 * Cloud provider constants
 */

/**
 * Supported cloud providers
 */
export const CLOUD_PROVIDERS = ['gcp', 'aws', 'azure'] as const;
/**
 * Azure resource providers a tsdevstack environment needs registered in its
 * subscription. cloud:init registers them early (registration takes a few
 * minutes); infra:bootstrap checks them again before Terraform.
 */
export const AZURE_REQUIRED_RESOURCE_PROVIDERS = [
  'Microsoft.ContainerRegistry',
  'Microsoft.App',
  'Microsoft.Web',
  'Microsoft.DBforPostgreSQL',
  'Microsoft.Cache',
  'Microsoft.Cdn',
  'Microsoft.Network',
  'Microsoft.OperationalInsights',
  'microsoft.insights',
  'Microsoft.ManagedIdentity',
  'Microsoft.Storage',
  'Microsoft.KeyVault',
] as const;
