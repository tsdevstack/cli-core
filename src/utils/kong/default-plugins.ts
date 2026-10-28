/**
 * Default Kong plugins configuration
 * Used in kong.user.yml template generation
 */

import type { KongPlugin } from './types';
import { KONG_REQUEST_ID_HEADER } from '../../constants';
import { buildKongRedisConfig } from './build-kong-redis-config';

/**
 * Returns the default set of operational Kong plugins for a new kong.user.yml:
 * request-transformer, CORS, rate-limiting, correlation-id.
 *
 * The request-transformer only removes X-Kong-Request-Id. It must not remove
 * identity headers (X-Consumer-*, X-Userinfo, ...): it runs after the auth
 * plugins and would delete the values they set. Client-sent identity headers
 * are removed by the framework plugin tsdevstack-strip-identity, and the
 * trust header is set by the framework plugin tsdevstack-trust.
 */
export function getDefaultKongPlugins(): KongPlugin[] {
  return [
    {
      name: 'request-transformer',
      config: {
        remove: {
          headers: [KONG_REQUEST_ID_HEADER],
        },
      },
    },
    // CORS
    {
      name: 'cors',
      config: {
        origins: ['${KONG_CORS_ORIGINS}'],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        headers: [
          'Accept',
          'Authorization',
          'Content-Type',
          'X-Request-ID',
          'x-api-key',
        ],
        exposed_headers: ['X-Request-ID'],
        credentials: true,
        max_age: 3600,
      },
    },
    // Rate limiting (Redis for distributed deployments). Global default for
    // every caller; on partner routes its windows become the API key
    // plugin's default limits, counted per key.
    {
      name: 'rate-limiting',
      config: {
        minute: 100,
        policy: 'redis',
        redis: buildKongRedisConfig(),
      },
    },
    // Correlation ID
    {
      name: 'correlation-id',
      config: {
        header_name: 'X-Request-ID',
        generator: 'uuid',
        echo_downstream: true,
      },
    },
  ];
}
