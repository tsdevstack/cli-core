import { join } from 'path';
import { TSDEVSTACK_DIR } from '../../constants';
import type { CloudProvider } from '../../plugin/types';

/**
 * Get absolute path to credentials file for a specific cloud provider
 */
export function getCredentialsPath(
  projectRoot: string,
  provider: CloudProvider
): string {
  return join(projectRoot, TSDEVSTACK_DIR, `.credentials.${provider}.json`);
}