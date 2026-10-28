/**
 * Secret Scopes
 *
 * A secret lives in the shared scope, which every service reads, unless
 * only one service reads it. Cloud: `{project}-{scope}-{KEY}`. Locally: the
 * top-level `secrets` block of .secrets.local.json is shared, a service's
 * section is its own scope.
 */

/** Scope every service reads besides its own */
export const SHARED_SECRET_SCOPE = 'shared';

/** The auth template's service (init scaffolds it under this name) */
export const AUTH_SERVICE_NAME = 'auth-service';

/**
 * Secrets only the auth-service reads (signing keys, refresh token secret,
 * first admins). They live in its scope, never in shared, so no other
 * service can read them. The *_PREVIOUS keys are set by hand while rotating
 * the signing key.
 */
export const AUTH_SERVICE_SECRETS = [
  'JWT_PRIVATE_KEY_CURRENT',
  'JWT_PUBLIC_KEY_CURRENT',
  'JWT_KEY_ID_CURRENT',
  'JWT_PRIVATE_KEY_PREVIOUS',
  'JWT_PUBLIC_KEY_PREVIOUS',
  'JWT_KEY_ID_PREVIOUS',
  'REFRESH_TOKEN_SECRET',
  'BCRYPT_ROUNDS',
  'ADMIN_EMAILS',
] as const;

/** Azure: the shared scope's Key Vault is `{project}-{env}-kv` */
export const AZURE_SHARED_KEY_VAULT_SUFFIX = 'kv';

/** Azure Key Vault names: 3-24 characters */
export const AZURE_KEY_VAULT_NAME_MAX_LENGTH = 24;

/** Characters of the name hash that keep a shortened Key Vault name unique */
export const AZURE_KEY_VAULT_NAME_HASH_LENGTH = 8;

/** Azure: env var with the shared vault's name, set on every backend container */
export const AZURE_KEYVAULT_NAME_ENV = 'AZURE_KEYVAULT_NAME';

/**
 * Azure: env var with the service's own vault's name. A container without it
 * was deployed before services had their own vault, and reads every scope
 * from the shared vault.
 */
export const AZURE_SERVICE_KEYVAULT_NAME_ENV = 'AZURE_SERVICE_KEYVAULT_NAME';
