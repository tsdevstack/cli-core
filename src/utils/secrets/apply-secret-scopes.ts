/**
 * Place each secret of the merged local secrets file in its scope
 */

import type { FrameworkConfig } from '../config';
import { SHARED_SECRET_SCOPE } from '../../constants';
import { getSecretScope } from './get-secret-scope';
import type { SecretsFile } from './types';

/**
 * Move each top-level secret whose scope is a service into that service's
 * section, so a service reads locally exactly what it can read in the
 * cloud. The top-level block is the shared scope. A value already in the
 * section wins (the service's own value); a secret whose service has no
 * section stays top-level.
 *
 * @param file - Merged secrets (framework + user)
 * @param config - Framework configuration
 * @returns A new file with service-scoped secrets in their sections
 */
export function applySecretScopes(
  file: SecretsFile,
  config: FrameworkConfig,
): SecretsFile {
  const result: SecretsFile = { ...file, secrets: { ...file.secrets } };

  for (const [key, value] of Object.entries(file.secrets)) {
    const scope = getSecretScope(key, config);
    const section = result[scope];
    if (
      scope === SHARED_SECRET_SCOPE ||
      !section ||
      typeof section !== 'object' ||
      Array.isArray(section)
    ) {
      continue;
    }

    result[scope] = { [key]: value, ...(section as Record<string, unknown>) };
    delete result.secrets[key];
  }

  return result;
}
