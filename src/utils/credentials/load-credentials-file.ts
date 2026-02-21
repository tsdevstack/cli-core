import type { CloudProvider } from '../../plugin/types';
import { readJsonFile } from '../fs';
import { getCredentialsPath } from '../paths/get-credentials-path';

/**
 * Load entire credentials file for a provider
 */
export function loadCredentialsFile(
  projectRoot: string,
  provider: CloudProvider
): Record<string, unknown> {
  const credentialsPath = getCredentialsPath(projectRoot, provider);

  try {
    return readJsonFile<Record<string, unknown>>(credentialsPath);
  } catch (error) {
    throw new Error(
      `Failed to load credentials file for ${provider}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}