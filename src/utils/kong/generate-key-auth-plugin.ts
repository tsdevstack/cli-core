/**
 * Generates Kong key-auth plugin configuration for partner API endpoints
 */

import type { KeyAuthPluginConfig } from './plugin-types';

/**
 * Generates Kong key-auth plugin configuration for partner API endpoints.
 *
 * @returns Key-auth plugin configuration
 */
export function generateKeyAuthPlugin(): KeyAuthPluginConfig {
  return {
    name: 'key-auth',
    config: {
      key_names: ['x-api-key'],
      hide_credentials: false,
    },
  };
}
