/**
 * Default Kong plugins configuration
 * Used in kong.user.yml template generation
 */

import type { KongPlugin } from './types';

/**
 * Returns the default set of operational Kong plugins
 * Includes: request-transformer (security headers), CORS, rate-limiting, correlation-id
 *
 * @param useAuthTemplate - When true, includes framework JWT claim headers
 *   (Sub, Email, Role, Confirmed) in the request-transformer remove list.
 *   When false, omits them (external OIDC providers use different claims).
 */
export function getDefaultKongPlugins(useAuthTemplate: boolean): KongPlugin[] {
  const jwtClaimHeaders = useAuthTemplate
    ? [
        'X-JWT-Claim-Sub',
        'X-JWT-Claim-Email',
        'X-JWT-Claim-Role',
        'X-JWT-Claim-Confirmed',
      ]
    : [];

  return [
    // Header security and trust token (Phase 5)
    {
      name: 'request-transformer',
      config: {
        remove: {
          headers: [
            'X-Consumer-Id',
            'X-Consumer-Username',
            ...jwtClaimHeaders,
            'X-Kong-Request-Id',
            'X-Kong-Trust',
          ],
        },
        add: {
          headers: ['X-Kong-Trust:${KONG_TRUST_TOKEN}'],
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
    // Rate limiting (Redis for distributed deployments)
    {
      name: 'rate-limiting',
      config: {
        minute: 100,
        policy: 'redis',
        redis: {
          host: '${REDIS_HOST}',
          port: '${REDIS_PORT}',
          password: '${REDIS_PASSWORD}',
          database: 0,
          timeout: 2000,
        },
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
