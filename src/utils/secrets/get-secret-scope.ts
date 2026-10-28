/**
 * Decide which scope a secret is stored in
 */

import { type FrameworkConfig, hasAuthTemplate } from '../config';
import {
  AUTH_SERVICE_NAME,
  AUTH_SERVICE_SECRETS,
  SHARED_SECRET_SCOPE,
} from '../../constants';

/**
 * The scope a secret belongs to: the auth-service's for the secrets only it
 * reads (auth template), shared for everything else. The one place that
 * decides it, for local generation and for every cloud.
 *
 * @param key - Secret key (e.g., 'JWT_PRIVATE_KEY_CURRENT')
 * @param config - Framework configuration
 * @returns The scope: a service name or 'shared'
 */
export function getSecretScope(key: string, config: FrameworkConfig): string {
  if (
    hasAuthTemplate(config) &&
    (AUTH_SERVICE_SECRETS as readonly string[]).includes(key)
  ) {
    return AUTH_SERVICE_NAME;
  }
  return SHARED_SECRET_SCOPE;
}
