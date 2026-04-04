/**
 * Bucket Name Validation
 *
 * Validates bucket logical names for storage commands.
 */

import { CliError } from '../errors';
import {
  BUCKET_NAME_MAX_LENGTH,
  BUCKET_RESERVED_NAMES,
  CLOUD_BUCKET_NAME_MAX_LENGTH,
  NAME_LENGTH,
} from '../../constants';
import type { FrameworkConfig } from '../config';

/** Standard environment names used when config.environments is not set */
const STANDARD_ENVIRONMENTS = ['dev', 'staging', 'prod'];

/**
 * Validate a bucket logical name
 *
 * Bucket names must:
 * - Be kebab-case: /^[a-z][a-z0-9-]*[a-z0-9]$/ (min 2 chars by regex)
 * - Max 30 chars
 * - Not be a reserved infrastructure name
 * - Not be a duplicate in existing config.storage.buckets
 * - Cloud bucket name ({project}-{name}-{env}) must be ≤ 63 chars
 *
 * @param name - The bucket logical name to validate
 * @param config - Framework config (for project name, environments, existing buckets)
 * @throws {CliError} If validation fails
 */
export function validateBucketName(
  name: string,
  config: FrameworkConfig,
): void {
  // Check for uppercase letters
  if (/[A-Z]/.test(name)) {
    throw new CliError(
      `Bucket name "${name}" contains uppercase letters.\n` +
        'Bucket names must be all lowercase.\n' +
        'Example: uploads, user-media',
    );
  }

  // Check for invalid characters (must be kebab-case)
  if (!/^[a-z0-9-]+$/.test(name)) {
    const errors: string[] = [];
    if (/_/.test(name)) {
      errors.push('- Use hyphens instead of underscores');
    }
    errors.push('- Only lowercase letters, numbers, and hyphens are allowed');

    throw new CliError(
      `Invalid bucket name: "${name}"\n` +
        errors.join('\n') +
        '\n\nExample valid names: uploads, user-media, export-data',
    );
  }

  // Must start with a letter
  if (!/^[a-z]/.test(name)) {
    throw new CliError(
      `Bucket name "${name}" must start with a letter.\n` +
        'Example: uploads, user-media',
    );
  }

  // Cannot start or end with hyphen
  if (/^-|-$/.test(name)) {
    throw new CliError(
      `Bucket name "${name}" cannot start or end with a hyphen.`,
    );
  }

  // Minimum length (regex requires 2 chars: first + last)
  if (name.length < NAME_LENGTH.MIN_PREFIX) {
    throw new CliError(
      `Bucket name "${name}" is too short (${name.length} character).\n` +
        `Minimum: ${NAME_LENGTH.MIN_PREFIX} characters`,
    );
  }

  // Maximum length
  if (name.length > BUCKET_NAME_MAX_LENGTH) {
    throw new CliError(
      `Bucket name "${name}" is too long (${name.length} characters).\n` +
        `Maximum: ${BUCKET_NAME_MAX_LENGTH} characters`,
    );
  }

  // Check reserved names
  const isReserved = BUCKET_RESERVED_NAMES.some(
    (reserved) => reserved === name,
  );
  if (isReserved) {
    throw new CliError(
      `Bucket name "${name}" is reserved for infrastructure.\n` +
        `Reserved names: ${BUCKET_RESERVED_NAMES.join(', ')}\n` +
        'Please choose a different name.',
    );
  }

  // Check for duplicates in existing buckets
  const existingBuckets = config.storage?.buckets ?? [];
  if (existingBuckets.includes(name)) {
    throw new CliError(
      `Bucket "${name}" already exists in config.\n` +
        `Existing buckets: ${existingBuckets.join(', ')}`,
    );
  }

  // Validate cloud bucket name length: {project}-{name}-{env} ≤ 63 chars
  const environmentNames = config.environments
    ? Object.keys(config.environments)
    : STANDARD_ENVIRONMENTS;
  const longestEnvName = environmentNames.reduce(
    (longest, env) => (env.length > longest.length ? env : longest),
    '',
  );
  const cloudBucketName = `${config.project.name}-${name}-${longestEnvName}`;
  if (cloudBucketName.length > CLOUD_BUCKET_NAME_MAX_LENGTH) {
    throw new CliError(
      `Cloud bucket name "${cloudBucketName}" is too long (${cloudBucketName.length} characters).\n` +
        `Maximum: ${CLOUD_BUCKET_NAME_MAX_LENGTH} characters (S3, GCS, Azure container limit).\n` +
        'Use a shorter bucket name or project name.',
    );
  }
}
