/**
 * Resolve credentials for a cloud provider
 *
 * Returns credentials from file (local) or null (CI uses ADC).
 */

import type { CloudProvider, GCPCredentials } from '../cloud/types';
import { isCIEnv } from '../ci/is-ci';
import { loadCredentialsFile } from './load-credentials-file';
import { findProjectRoot } from '../paths/find-project-root';

/**
 * Resolve credentials for a cloud provider and environment.
 *
 * - Local: Returns credentials from `.tsdevstack/.credentials.{provider}.json`
 * - CI: Returns null (SDK uses Application Default Credentials set up by WIF)
 *
 * @param provider - Cloud provider ('gcp', 'aws', 'azure')
 * @param env - Target environment ('dev', 'staging', 'prod')
 * @returns Credentials object or null for ADC
 */
export function resolveCredentials(
  provider: CloudProvider,
  env: string,
): GCPCredentials | null {
  if (isCIEnv()) {
    // CI: return null = use Application Default Credentials (ADC)
    // WIF (Workload Identity Federation) sets up ADC automatically
    // via google-github-actions/auth action
    return null;
  }

  // Local: load from credentials file
  const projectRoot = findProjectRoot();
  const allCredentials = loadCredentialsFile(projectRoot, provider);
  const envCredentials = allCredentials[env];

  if (!envCredentials) {
    throw new Error(
      `No credentials found for environment "${env}" in ${provider} credentials file`,
    );
  }

  return envCredentials as GCPCredentials;
}