import type { CloudProvider } from '../../plugin/types';
import { loadCredentialsFile } from './load-credentials-file';

/**
 * Get available environments from credentials file
 */
export function getAvailableEnvironments(
  projectRoot: string,
  provider: CloudProvider
): string[] {
  const credentialsFile = loadCredentialsFile(projectRoot, provider);
  return Object.keys(credentialsFile);
}