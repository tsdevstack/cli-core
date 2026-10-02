/**
 * Warn when a request-transformer still removes identity headers
 */

import type { KongPlugin, KongTemplate } from './types';
import { logger } from '../logger';
import {
  KONG_CLIENT_IDENTITY_HEADERS,
  KONG_STRIP_IDENTITY_PLUGIN_NAME,
  KONG_TRUST_HEADER,
} from '../../constants';

/** Identity headers set by Kong's auth plugins (X-Kong-Trust excluded) */
const AUTH_IDENTITY_HEADERS = new Set(
  KONG_CLIENT_IDENTITY_HEADERS.filter((h) => h !== KONG_TRUST_HEADER).map((h) =>
    h.toLowerCase(),
  ),
);

/**
 * Returns the identity headers (X-Consumer-*, X-Userinfo,
 * X-Credential-Identifier, ...) that a request-transformer in `config`
 * removes, and logs a warning when there are any.
 *
 * Why it matters: request-transformer runs after the auth plugins (priority
 * 801), so removing these headers deletes the values tsdevstack-api-key and
 * oidc just set; `@Partner()` then gets no consumer. Client-sent values are already
 * removed by tsdevstack-strip-identity before authentication.
 *
 * Checks global, service-level and consumer-level request-transformers.
 *
 * @param config - Kong config from a user-owned file
 * @param fileName - File name for the warning (e.g. kong.user.yml)
 * @returns The offending header names as written in the file
 */
export function validateRequestTransformerHeaders(
  config: KongTemplate,
  fileName: string,
): string[] {
  const plugins: KongPlugin[] = [
    ...(config.plugins || []),
    ...(config.services || []).flatMap((s) => s.plugins || []),
    ...(config.consumers || []).flatMap((c) => c.plugins || []),
  ];

  const offending = [
    ...new Set(
      plugins
        .filter((plugin) => plugin.name === 'request-transformer')
        .flatMap((plugin) => {
          const remove = plugin.config.remove as
            { headers?: unknown } | undefined;
          return Array.isArray(remove?.headers) ? remove.headers : [];
        })
        .filter((h): h is string => typeof h === 'string')
        .filter((h) => AUTH_IDENTITY_HEADERS.has(h.toLowerCase())),
    ),
  ];

  if (offending.length > 0) {
    logger.warn(
      `${fileName}: request-transformer removes identity headers: ${offending.join(', ')}`,
    );
    logger.warn(
      '   It runs after the auth plugins, so it deletes the identity Kong just set (for example X-Userinfo from oidc, or X-Api-Key-Consumer from the API key plugin: @Partner() gets no consumer).',
    );
    logger.warn(
      `   Client-sent identity headers are already removed by ${KONG_STRIP_IDENTITY_PLUGIN_NAME}. Remove these entries; keep only X-Kong-Request-Id and X-Kong-Trust.`,
    );
  }

  return offending;
}
