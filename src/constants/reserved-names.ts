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
  // Secret scopes: "shared" is the scope every service reads, "secrets" the
  // block of .secrets.local.json that holds it
  'shared',
  'secrets',
  // Azure: the shared Key Vault is {project}-{env}-kv, a service's vault
  // {project}-{env}-{service}
  'kv',
] as const;

/**
 * Type helper for reserved names
 */
export type ReservedName = (typeof RESERVED_NAMES)[number];
