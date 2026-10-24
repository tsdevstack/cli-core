/**
 * Storage Constants
 *
 * Local object storage (RustFS, S3-compatible) defaults and bucket name limits.
 */

/** S3 endpoint of the local object storage */
export const LOCAL_STORAGE_ENDPOINT = 'http://localhost:9000';

/** Root access key of the local object storage */
export const LOCAL_STORAGE_ACCESS_KEY = 'rustfsadmin';

/** Root secret key of the local object storage */
export const LOCAL_STORAGE_SECRET_KEY = 'rustfsadmin';

/** The local server needs path-style access (not virtual-hosted) */
export const LOCAL_STORAGE_FORCE_PATH_STYLE = 'true';

/** Web console port of the local object storage */
export const LOCAL_STORAGE_CONSOLE_PORT = '9001';

/** S3 API port of the local object storage */
export const LOCAL_STORAGE_API_PORT = '9000';

/**
 * Image of the local object storage server. RustFS is Apache-2.0 and
 * S3-compatible; MinIO's images left Docker Hub in September 2026.
 */
export const LOCAL_STORAGE_IMAGE = 'rustfs/rustfs:1.0.3';

/** Image of the one-shot container that creates the buckets (s5cmd) */
export const LOCAL_STORAGE_INIT_IMAGE = 'peakcom/s5cmd:v2.3.0';

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
  'rustfs',
  'storage',
] as const;
