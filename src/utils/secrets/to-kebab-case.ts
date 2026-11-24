import { transformKey } from 'deep-case-crafter';

/**
 * Convert a SCREAMING_SNAKE_CASE secret key to kebab-case: letters become
 * lowercase and underscores become hyphens.
 *
 * The key is lowercased first, because deep-case-crafter keeps
 * SCREAMING_SNAKE_CASE names unchanged. A key it still returns unchanged
 * (`a__b`, `_private`) gets the plain conversion instead, so every key
 * converts exactly as before.
 *
 * @example
 * toKebabCase('REDIS_PASSWORD') // => 'redis-password'
 * toKebabCase('KONG_TRUST_TOKEN') // => 'kong-trust-token'
 */
export function toKebabCase(key: string): string {
  const lower = key.toLowerCase();
  const plain = lower.replace(/_/g, '-');
  const converted = transformKey(lower, { targetCase: 'kebab' });
  return converted === lower ? plain : converted;
}
