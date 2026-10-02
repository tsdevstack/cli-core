/**
 * Generate exact Kong routes (one per path) from OpenAPI operations
 */

import { createHash } from 'crypto';
import type { KongRoute } from './types';
import type { RouteSecurityInfo } from '../openapi';
import { groupRoutesByPath } from '../openapi/group-routes-by-path';
import { KONG_ROUTE_EXTRA_METHODS } from '../../constants';
import { buildKongRouteSlug } from './build-kong-route-slug';
import { countLiteralPathSegments } from './count-literal-path-segments';
import { openApiPathToKongRegex } from './openapi-path-to-kong-regex';

export interface GenerateExactRoutesOptions {
  /** OpenAPI operations of one security type */
  routes: RouteSecurityInfo[];
  /** Route name prefix, e.g. `offers-service-jwt` */
  namePrefix: string;
  /** Public path prefix in front of the OpenAPI path (partner routes: `/api`) */
  pathPrefix?: string;
}

/**
 * Returns one route per OpenAPI path, sorted by path:
 *
 * - `paths`: one anchored regex (see openApiPathToKongRegex)
 * - `methods`: the path's OpenAPI methods plus OPTIONS (CORS preflight)
 * - `regex_priority`: number of literal segments (literals beat parameters)
 * - `strip_path: false`: the backend receives the path unchanged (partner
 *   services remove the prefix with tsdevstack-api-prefix)
 *
 * One route per path (not per operation) keeps the config small and gives
 * each route a name derived from its path alone. Names are
 * `{namePrefix}-{slug}`; when two paths share a slug, both get a short hash
 * of the path appended, so a name only depends on the path set.
 *
 * @returns Kong routes
 */
export function generateExactRoutes(
  options: GenerateExactRoutesOptions,
): KongRoute[] {
  const pathPrefix = options.pathPrefix ?? '';
  const methodsByPath = groupRoutesByPath(options.routes);
  const paths = Array.from(methodsByPath.keys()).sort();

  const slugCounts = new Map<string, number>();
  for (const path of paths) {
    const slug = buildKongRouteSlug(path);
    slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
  }

  return paths.map((path) => {
    const slug = buildKongRouteSlug(path);
    const suffix =
      (slugCounts.get(slug) ?? 0) > 1
        ? `-${createHash('sha256').update(path).digest('hex').slice(0, 8)}`
        : '';
    const methods = new Set(
      (methodsByPath.get(path) ?? []).map((method) => method.toUpperCase()),
    );

    return {
      name: `${options.namePrefix}-${slug}${suffix}`,
      paths: [openApiPathToKongRegex(path, pathPrefix)],
      methods: [
        ...Array.from(methods).sort(),
        ...KONG_ROUTE_EXTRA_METHODS.filter((m) => !methods.has(m)),
      ],
      regex_priority: countLiteralPathSegments(`${pathPrefix}${path}`),
      strip_path: false,
    };
  });
}
