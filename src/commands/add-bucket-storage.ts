/**
 * Add Bucket Storage Command
 *
 * Adds an object storage bucket to the project config and runs sync.
 *
 * Usage:
 *   npx tsdevstack add-bucket-storage
 *   npx tsdevstack add-bucket-storage --name uploads
 */

import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { loadFrameworkConfig, saveFrameworkConfig } from '../utils/config';
import { validateBucketName } from '../utils/validation/validate-bucket-name';
import { sync } from './sync';
import { MINIO_CONSOLE_PORT } from '../constants';

export interface AddBucketStorageOptions {
  name?: string;
}

/**
 * Add an object storage bucket to the project
 */
export async function addBucketStorage(
  options: AddBucketStorageOptions,
): Promise<void> {
  logger.newline();
  logger.info('Add object storage bucket to your project');
  logger.newline();

  const config = loadFrameworkConfig();

  // Get bucket name
  let bucketName = options.name;
  if (!bucketName) {
    const nameAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Bucket name (kebab-case):',
        validate: (input: string) => {
          try {
            validateBucketName(input, config);
            return true;
          } catch (error) {
            if (error instanceof Error) {
              return error.message;
            }
            return 'Invalid bucket name';
          }
        },
      },
    ]);
    bucketName = nameAnswer.name;
  } else {
    validateBucketName(bucketName, config);
  }

  const name = bucketName as string;

  // Update config
  if (!config.storage) {
    config.storage = { buckets: [] };
  }
  config.storage.buckets.push(name);
  saveFrameworkConfig(config);

  logger.success(`Added bucket "${name}" to config`);
  logger.newline();

  // Run sync to regenerate docker-compose + secrets
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

  // Success message
  logger.newline();
  logger.success(`Bucket "${name}" added successfully`);
  logger.newline();
  logger.info('Local development:');
  logger.info('  Run "npx tsdevstack sync" to start MinIO');
  logger.info(
    `  MinIO Console: http://localhost:${MINIO_CONSOLE_PORT} (minioadmin/minioadmin)`,
  );
  logger.newline();
}
