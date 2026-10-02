/**
 * Count the literal segments of an OpenAPI path (Kong regex_priority)
 */

/**
 * Returns the number of path segments without a `{param}`.
 *
 * Used as `regex_priority` of generated routes: Kong gives every regex route
 * the same length weight, so `/plans/featured` and `/plans/{id}` would tie.
 * With this priority the route with more literal segments wins, as in
 * Express. Shapes that are ambiguous both ways (`/a/{x}/c` vs `/a/b/{y}`)
 * stay ambiguous.
 *
 * @param path - Path with `{param}` placeholders (prefix included)
 * @returns Number of literal segments
 */
export function countLiteralPathSegments(path: string): number {
  return path
    .split('/')
    .filter((segment) => segment.length > 0 && !segment.includes('{')).length;
}
