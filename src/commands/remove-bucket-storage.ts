/**
 * Remove Bucket Storage Command
 *
 * Removes an object storage bucket from the project config and runs sync.
 * The actual cloud bucket destruction happens on next infra:deploy.
 *
 * Usage:
 *   npx tsdevstack remove-bucket-storage
 *   npx tsdevstack remove-bucket-storage --name uploads
 *   npx tsdevstack remove-bucket-storage --name uploads --force
 */

import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { loadFrameworkConfig, saveFrameworkConfig } from '../utils/config';
import { CliError } from '../utils/errors';
import { sync } from './sync';

export interface RemoveBucketStorageOptions {
  name?: string;
  force?: boolean;
}

/**
 * Remove an object storage bucket from the project
 */
export async function removeBucketStorage(
  options: RemoveBucketStorageOptions,
): Promise<void> {
  logger.newline();
  logger.warn('Remove Bucket Storage');
  logger.newline();

  const config = loadFrameworkConfig();
  const existingBuckets = config.storage?.buckets ?? [];

  if (existingBuckets.length === 0) {
    throw new CliError(
      'No storage buckets found in config',
      'remove-bucket-storage',
      'Add a bucket first with: npx tsdevstack add-bucket-storage',
    );
  }

  // Resolve bucket name
  let bucketName = options.name;
  if (!bucketName) {
    const { selectedBucket } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedBucket',
        message: 'Select bucket to remove:',
        choices: existingBuckets.map((b) => ({ name: b, value: b })),
      },
    ]);
    bucketName = selectedBucket as string;
  }

  const name = bucketName as string;

  // Validate bucket exists
  if (!existingBuckets.includes(name)) {
    throw new CliError(
      `Bucket "${name}" not found in config`,
      'remove-bucket-storage',
      `Available buckets: ${existingBuckets.join(', ')}`,
    );
  }

  // Show destruction warning
  if (!options.force) {
    logger.newline();
    logger.warn(
      `Removing bucket "${name}" will permanently destroy all data it contains on next infra:deploy.`,
    );
    logger.newline();
    logger.info(
      '  AWS S3:    force_destroy=true — ALL objects and versions are deleted. NOT recoverable.',
    );
    logger.info(
      '  GCS:       force_destroy=true — ALL objects are deleted. NOT recoverable.',
    );
    logger.info(
      '  Azure:     Container deleted. Blob soft delete on the storage account MAY allow recovery',
    );
    logger.info(
      '             — check Portal → Storage account → "Data protection"',
    );
    logger.newline();

    const { confirmed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: `Remove bucket "${name}"?`,
        default: false,
      },
    ]);

    if (!confirmed) {
      logger.info('Aborted.');
      return;
    }
  }

  // Update config
  const updatedBuckets = existingBuckets.filter((b) => b !== name);
  if (updatedBuckets.length === 0) {
    delete config.storage;
  } else {
    config.storage = { buckets: updatedBuckets };
  }
  saveFrameworkConfig(config);

  logger.success(`Removed bucket "${name}" from config`);
  logger.newline();

  // Run sync
  logger.info('Running sync to regenerate infrastructure files...');
  logger.newline();

  try {
    sync();
  } catch (error) {
    logger.warn(
      `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    logger.info('You may need to run "npx tsdevstack sync" manually.');
  }

  // Post-removal hints
  logger.newline();
  logger.success(`Bucket "${name}" removed from config`);
  logger.newline();
  logger.warn(
    `Bucket "${name}" will be PERMANENTLY DESTROYED on next infra:deploy.`,
  );
  logger.newline();
  logger.info('Back up any important data BEFORE running infra:deploy.');
  logger.newline();
}
