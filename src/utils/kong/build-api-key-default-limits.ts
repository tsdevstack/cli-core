/**
 * Derive the API key plugin's default limits from the global rate limiter
 */

import type { KongPlugin, KongTemplate } from './types';
import type { ApiKeyDefaultLimits } from './plugin-types';
import { logger } from '../logger';
import {
  KONG_API_KEY_DEFAULT_LIMIT_WINDOWS,
  KONG_API_KEY_UNSUPPORTED_LIMIT_WINDOWS,
  KONG_RATE_LIMITING_PLUGIN_NAME,
} from '../../constants';

/**
 * A top-level plugin entry that applies to every request: enabled and not
 * scoped to a service, route or consumer.
 */
function isGlobalEnabled(plugin: KongPlugin): boolean {
  const scoped = ['service', 'route', 'consumer'].some(
    (field) => field in plugin,
  );
  return plugin.enabled !== false && !scoped;
}

/**
 * Returns the windows of the global rate-limiting plugin in kong.user.yml
 * as `default_limits` of tsdevstack-api-key: partner keys without their own
 * limit for a window get the global value, counted per key. The global
 * limiter itself does not run on partner services (the per-IP ceiling
 * replaces it there).
 *
 * `minute`, `hour`, `day` and `month` are copied as written (numbers or
 * placeholders). The key plugin has no `second` or `year` window: they are
 * ignored for partner keys, with a warning. Rate-limiting has no `week`, so
 * keys have no default week limit. Without an enabled global rate-limiting
 * plugin, keys without their own limits are only bounded by the per-IP
 * ceiling (info line).
 *
 * @param userConfig - kong.user.yml as read (undefined when there is none)
 * @param fileName - File name for messages
 * @returns Default limits (empty without a global limiter)
 */
export function buildApiKeyDefaultLimits(
  userConfig: KongTemplate | undefined,
  fileName = 'kong.user.yml',
): ApiKeyDefaultLimits {
  const plugin = (userConfig?.plugins ?? []).find(
    (p) => p.name === KONG_RATE_LIMITING_PLUGIN_NAME && isGlobalEnabled(p),
  );

  if (!plugin) {
    logger.info(
      `${fileName} has no global ${KONG_RATE_LIMITING_PLUGIN_NAME} plugin: API keys without their own limits are only limited by the per-IP ceiling.`,
    );
    return {};
  }

  const config = (plugin.config ?? {}) as Record<string, unknown>;
  const present = (window: string): boolean =>
    config[window] !== undefined && config[window] !== null;

  const limits: ApiKeyDefaultLimits = {};
  for (const window of KONG_API_KEY_DEFAULT_LIMIT_WINDOWS) {
    const value = config[window];
    if (typeof value === 'number' || typeof value === 'string') {
      limits[window] = value;
    }
  }

  const unsupported = KONG_API_KEY_UNSUPPORTED_LIMIT_WINDOWS.filter(present);
  if (unsupported.length > 0) {
    logger.warn(
      `${fileName}: the global ${KONG_RATE_LIMITING_PLUGIN_NAME} sets ${unsupported.join(', ')}; API keys have no such window, so partner routes ignore ${unsupported.length > 1 ? 'them' : 'it'}.`,
    );
    logger.warn(
      '   API key windows: minute, hour, day, week, month (default limits come from the global minute, hour, day and month).',
    );
  }

  return limits;
}
