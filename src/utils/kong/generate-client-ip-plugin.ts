/**
 * Generates the tsdevstack-client-ip plugin entry
 */

import {
  KONG_CLIENT_IP_HEADER,
  KONG_CLIENT_IP_PLUGIN_NAME,
  KONG_FRONTEND_TOKEN_HEADER,
  KONG_FRONTEND_TOKEN_SECRET,
  KONG_UPSTREAM_CLIENT_IP_HEADER,
} from '../../constants';
import type { ClientIpPluginConfig } from './plugin-types';

/**
 * Returns the global tsdevstack-client-ip plugin: when a request carries the
 * frontend token, the visitor address the frontend server sent becomes the
 * client the global rate limit counts, and the address backends receive in
 * X-Tsdevstack-Real-IP for their own per-IP limits. The token is the
 * ${KONG_FRONTEND_TOKEN} placeholder, resolved from the local secrets
 * (generate-kong) or the cloud secret store (infra:build-kong).
 *
 * @returns Plugin entry
 */
export function generateClientIpPlugin(): ClientIpPluginConfig {
  return {
    name: KONG_CLIENT_IP_PLUGIN_NAME,
    config: {
      frontend_token: `\${${KONG_FRONTEND_TOKEN_SECRET}}`,
      client_ip_header: KONG_CLIENT_IP_HEADER,
      token_header: KONG_FRONTEND_TOKEN_HEADER,
      real_ip_header: KONG_UPSTREAM_CLIENT_IP_HEADER,
    },
  };
}
