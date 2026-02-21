/**
 * Reserved Service Names
 *
 * Infrastructure names that cannot be used as service names.
 */

/**
 * Reserved infrastructure names that cannot be used as service names
 */
export const RESERVED_NAMES = [
  'gateway',
  'kong',
  'redis',
  'postgres',
  'postgresql',
  'mysql',
  'mongodb',
] as const;

/**
 * Type helper for reserved names
 */
export type ReservedName = (typeof RESERVED_NAMES)[number];