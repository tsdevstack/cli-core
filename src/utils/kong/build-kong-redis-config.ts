/**
 * Redis block shared by the framework's Kong plugins
 */

import type { KongRedisConfig } from './plugin-types';

/**
 * Returns the Redis connection block of the global rate-limiting plugin in a
 * new kong.user.yml, the per-IP ceiling and tsdevstack-api-key. The
 * placeholders resolve from `.secrets.local.json` (generate-kong, with
 * REDIS_HOST replaced by the compose service name) and from the cloud secret
 * manager (infra:build-kong); infra:generate-kong adds TLS on AWS and Azure.
 *
 * @returns A new Redis block (callers may change it)
 */
export function buildKongRedisConfig(): KongRedisConfig {
  return {
    host: '${REDIS_HOST}',
    port: '${REDIS_PORT}',
    password: '${REDIS_PASSWORD}',
    database: 0,
    timeout: 2000,
  };
}
