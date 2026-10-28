/**
 * Generates the tsdevstack-trust plugin entry
 */

import {
  KONG_TRUST_HEADER,
  KONG_TRUST_PLUGIN_NAME,
  KONG_TRUST_TOKEN_SECRET,
} from '../../constants';
import type { TrustPluginConfig } from './plugin-types';

/**
 * Returns the global tsdevstack-trust plugin: sets the trust header on every
 * request Kong passes to a backend. The token is the ${KONG_TRUST_TOKEN}
 * placeholder, which generate-kong and infra:build-kong turn into an env
 * vault reference: Kong reads the value from its environment when it starts.
 *
 * @returns Plugin entry
 */
export function generateTrustPlugin(): TrustPluginConfig {
  return {
    name: KONG_TRUST_PLUGIN_NAME,
    config: {
      token: `\${${KONG_TRUST_TOKEN_SECRET}}`,
      header: KONG_TRUST_HEADER,
    },
  };
}
