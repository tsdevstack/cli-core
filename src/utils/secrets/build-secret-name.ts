/**
 * Build cloud secret name following convention: {projectName}-{scope}-{KEY}
 *
 * Used across CLI packages to construct consistent secret names
 * for Secret Manager (GCP), Secrets Manager (AWS), Key Vault (Azure).
 */
export function buildSecretName(
  projectName: string,
  scope: string,
  key: string
): string {
  return `${projectName}-${scope}-${key}`;
}