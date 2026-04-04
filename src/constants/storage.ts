/**
 * Storage Constants
 *
 * MinIO defaults for local development and bucket name limits.
 */

/** MinIO S3-compatible endpoint for local development */
export const LOCAL_STORAGE_ENDPOINT = 'http://localhost:9000';

/** MinIO default root user */
export const LOCAL_STORAGE_ACCESS_KEY = 'minioadmin';

/** MinIO default root password */
export const LOCAL_STORAGE_SECRET_KEY = 'minioadmin';

/** MinIO requires path-style access (not virtual-hosted) */
export const LOCAL_STORAGE_FORCE_PATH_STYLE = 'true';

/** MinIO web console port */
export const MINIO_CONSOLE_PORT = '9001';

/** MinIO S3 API port */
export const MINIO_API_PORT = '9000';

/** Maximum length for a bucket logical name */
export const BUCKET_NAME_MAX_LENGTH = 30;

/** Maximum length for a cloud bucket name ({project}-{name}-{env}) */
export const CLOUD_BUCKET_NAME_MAX_LENGTH = 63;

/** Maximum length for Azure storage account name */
export const AZURE_STORAGE_ACCOUNT_NAME_MAX_LENGTH = 24;

/** Suffix appended to Azure storage account names */
export const AZURE_STORAGE_ACCOUNT_SUFFIX = 'storage';

/** Reserved names that cannot be used as bucket names */
export const BUCKET_RESERVED_NAMES = [
  'gateway',
  'kong',
  'redis',
  'postgres',
  'postgresql',
  'mysql',
  'mongodb',
  'minio',
  'storage',
] as const;
