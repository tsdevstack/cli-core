/**
 * Resolve the global route prefix of a service
 */

import type { FrameworkService } from './types';

/**
 * Returns the service's `globalPrefix`, or its name without `-service` when
 * none is set (e.g. offers-service -> offers).
 *
 * One rule for local (generate-kong) and cloud (infra:generate-kong) so
 * gateway URLs match across environments.
 *
 * Replaces the first occurrence of `-service`, not only a trailing one, on
 * purpose: this is the rule infra:generate-kong always used, so existing cloud
 * URLs stay the same (e.g. my-service-api -> my-api).
 */
export function resolveGlobalPrefix(
  service: Pick<FrameworkService, 'name' | 'globalPrefix'>,
): string {
  return service.globalPrefix || service.name.replace('-service', '');
}
