/**
 * Build the readable part of a generated Kong route name
 */

/**
 * Turns an OpenAPI path into a route name fragment made of the characters
 * Kong accepts in names: `/offers/v2.1/plans/{id}` becomes
 * `offers-v2-1-plans-id`. Different paths can give the same slug; the caller
 * disambiguates them.
 *
 * @param path - OpenAPI path
 * @returns Lowercase slug, or `root` for `/`
 */
export function buildKongRouteSlug(path: string): string {
  const slug = path
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'root';
}
