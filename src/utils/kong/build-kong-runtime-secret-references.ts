/**
 * Env vault references for the secrets Kong reads when it starts
 */

import { KONG_RUNTIME_SECRETS } from '../../constants';

/**
 * The value each Kong runtime secret placeholder resolves to: a reference to
 * Kong's env vault, which reads the environment variable of the same name
 * when Kong starts (`{vault://env/redis-password}` reads REDIS_PASSWORD).
 * The secret values themselves never reach the Kong config or image.
 *
 * @returns Placeholder name to reference, for each KONG_RUNTIME_SECRETS key
 */
export function buildKongRuntimeSecretReferences(): Record<string, string> {
  return Object.fromEntries(
    KONG_RUNTIME_SECRETS.map((key) => [
      key,
      `{vault://env/${key.toLowerCase().replace(/_/g, '-')}}`,
    ]),
  );
}
