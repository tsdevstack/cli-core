/**
 * Secrets-related constants
 */

/**
 * Prefix used for metadata fields in secrets files
 * Metadata fields start with '$' (e.g., $comment, $warning, $instructions)
 */
export const METADATA_PREFIX = '$';

/**
 * Secrets file names
 */
export const FRAMEWORK_SECRETS_FILE = '.secrets.tsdevstack.json';
export const USER_SECRETS_FILE = '.secrets.user.json';
export const LOCAL_SECRETS_FILE = '.secrets.local.json';

/**
 * Default secret references for different service types
 * NODE_ENV is included for backend services to ensure proper environment detection
 * LOG_LEVEL is included for pino logger configuration (debug in dev, info in prod)
 * REDIS_* secrets are included for caching/session management (flattened, no nesting)
 * API_KEY is NOT included - per-service keys are managed in user secrets
 * TTL values are managed in user secrets and referenced by services that need them
 */
export const BACKEND_DEFAULT_SECRETS = [
  'NODE_ENV',
  'LOG_LEVEL',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'REDIS_TLS',
] as const;
export const NEXTJS_SECRETS = [
  'ACCESS_TOKEN_TTL',
  'REFRESH_TOKEN_TTL',
] as const;

/**
 * TTL values that auth-service needs from user file
 */
export const AUTH_TTL_SECRETS = [
  'ACCESS_TOKEN_TTL',
  'REFRESH_TOKEN_TTL',
  'CONFIRMATION_TOKEN_TTL',
] as const;
