/**
 * Convert an OpenAPI path into an exact Kong regex route path
 */

import { KONG_PATH_PARAM_PATTERN } from '../../constants';
import { escapeKongRegexLiteral } from './escape-kong-regex-literal';

/** One OpenAPI path parameter, e.g. `{id}` */
const OPENAPI_PARAM = /\{[^/{}]+\}/g;

/**
 * Returns the Kong regex path that matches exactly `prefix + openApiPath`:
 *
 * - `~` marks a regex path; Kong adds the leading `^` itself
 * - each `{param}` matches one non-empty segment (`[^/]+`)
 * - literal text is regex-escaped (`v2.1` matches only `v2.1`)
 * - `$` anchors the end: no extra segments, no trailing slash
 *
 * @example
 * openApiPathToKongRegex('/offers/v1/plans/{id}') // '~/offers/v1/plans/[^/]+$'
 * openApiPathToKongRegex('/offers/v1/plans', '/api') // '~/api/offers/v1/plans$'
 *
 * @param openApiPath - Path from the OpenAPI document (starts with `/`)
 * @param prefix - Public path prefix in front of it (e.g. `/api`), default none
 * @returns The Kong route path
 */
export function openApiPathToKongRegex(
  openApiPath: string,
  prefix = '',
): string {
  const fullPath = `${prefix}${openApiPath}`;
  let pattern = '';
  let last = 0;

  for (const match of fullPath.matchAll(OPENAPI_PARAM)) {
    pattern += escapeKongRegexLiteral(fullPath.slice(last, match.index));
    pattern += KONG_PATH_PARAM_PATTERN;
    last = match.index + match[0].length;
  }
  pattern += escapeKongRegexLiteral(fullPath.slice(last));

  return `~${pattern}$`;
}
