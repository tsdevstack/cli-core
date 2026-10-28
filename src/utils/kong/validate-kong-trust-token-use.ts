/**
 * Fail when a Kong config uses the trust token outside tsdevstack-trust
 */

import { CliError } from '../errors';
import {
  KONG_TRUST_HEADER,
  KONG_TRUST_PLUGIN_NAME,
  KONG_TRUST_TOKEN_SECRET,
} from '../../constants';
import type { KongTemplate } from './types';

/**
 * The trust token reaches Kong as an env vault reference, which only a
 * referenceable plugin field resolves; request-transformer headers are not
 * referenceable. A kong.user.yml from before tsdevstack-trust still adds
 * `X-Kong-Trust:${KONG_TRUST_TOKEN}` through request-transformer: Kong would
 * send the reference text and every backend would reject the request. Such a
 * config stops here, with the lines to delete.
 *
 * Checks every plugin in the config (global, service, route, consumer).
 *
 * @param config - Kong config (kong.user.yml, kong.custom.yml or a merged one)
 * @param fileName - File to name in the error
 * @throws CliError when a plugin other than tsdevstack-trust uses the token
 */
export function validateKongTrustTokenUse(
  config: KongTemplate,
  fileName: string,
): void {
  const placeholder = `\${${KONG_TRUST_TOKEN_SECRET}}`;
  const offending = new Set<string>();

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') {
      return;
    }
    const entry = node as { name?: unknown; config?: unknown };
    if (typeof entry.name === 'string' && entry.config !== undefined) {
      if (
        entry.name !== KONG_TRUST_PLUGIN_NAME &&
        JSON.stringify(entry.config).includes(placeholder)
      ) {
        offending.add(entry.name);
      }
      return;
    }
    Object.values(node).forEach(visit);
  };
  visit(config);

  if (offending.size > 0) {
    throw new CliError(
      `${fileName}: ${[...offending].join(', ')} uses ${placeholder}`,
      'Kong configuration',
      `The framework plugin ${KONG_TRUST_PLUGIN_NAME} sets ${KONG_TRUST_HEADER} now, and Kong reads the token at startup instead of from its image. ` +
        `In ${fileName}, delete "${KONG_TRUST_HEADER}:${placeholder}" from the request-transformer's add.headers (and "${KONG_TRUST_HEADER}" from its remove.headers). ` +
        `A kong.custom.yml needs ${KONG_TRUST_PLUGIN_NAME} as a global plugin, with token: ${placeholder}.`,
    );
  }
}
