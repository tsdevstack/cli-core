import { transformKey } from 'deep-case-crafter';

/**
 * Convert kebab-case service name to SCREAMING_SNAKE_CASE
 *
 * deep-case-crafter converts the name. A name with a capital letter, or one it
 * returns unchanged (`a--b`, `2-api`, `api.service`), gets the plain
 * conversion instead, so every name converts exactly as before.
 *
 * @example
 * toScreamingSnakeCase('auth-service') // => 'AUTH_SERVICE'
 * toScreamingSnakeCase('my-api-v2') // => 'MY_API_V2'
 */
export function toScreamingSnakeCase(kebabCase: string): string {
  const plain = kebabCase.replace(/-/g, '_').toUpperCase();
  if (/[A-Z]/.test(kebabCase)) return plain;
  const converted = transformKey(kebabCase, { targetCase: 'constant' });
  return converted === kebabCase ? plain : converted;
}
