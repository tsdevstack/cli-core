/**
 * Convert kebab-case service name to SCREAMING_SNAKE_CASE
 *
 * @example
 * toScreamingSnakeCase('auth-service') // => 'AUTH_SERVICE'
 * toScreamingSnakeCase('my-api-v2') // => 'MY_API_V2'
 */
export function toScreamingSnakeCase(kebabCase: string): string {
  return kebabCase.replace(/-/g, '_').toUpperCase();
}