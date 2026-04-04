/**
 * Remove Messaging Topic Command
 *
 * Removes a messaging topic from the project config and runs sync.
 *
 * Usage:
 *   npx tsdevstack remove-messaging-topic
 *   npx tsdevstack remove-messaging-topic --name user-created
 */

import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { loadFrameworkConfig, saveFrameworkConfig } from '../utils/config';
import { CliError } from '../utils/errors';
import { sync } from './sync';

export interface RemoveMessagingTopicOptions {
  name?: string;
}

/**
 * Remove a messaging topic from the project
 */
export async function removeMessagingTopic(
  options: RemoveMessagingTopicOptions,
): Promise<void> {
  logger.newline();
  logger.info('Remove messaging topic');
  logger.newline();

  const config = loadFrameworkConfig();
  const existingTopics = config.messaging?.topics ?? [];

  if (existingTopics.length === 0) {
    throw new CliError(
      'No messaging topics found in config',
      'remove-messaging-topic',
      'Add a topic first with: npx tsdevstack add-messaging-topic',
    );
  }

  // Resolve topic name
  let topicName = options.name;
  if (!topicName) {
    const { selectedTopic } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTopic',
        message: 'Select topic to remove:',
        choices: existingTopics.map((t) => ({ name: t.name, value: t.name })),
      },
    ]);
    topicName = selectedTopic as string;
  }

  const name = topicName as string;

  // Validate topic exists
  if (!existingTopics.some((t) => t.name === name)) {
    throw new CliError(
      `Topic "${name}" not found in config`,
      'remove-messaging-topic',
      `Available topics: ${existingTopics.map((t) => t.name).join(', ')}`,
    );
  }

  // Update config
  const updatedTopics = existingTopics.filter((t) => t.name !== name);
  if (updatedTopics.length === 0) {
    delete config.messaging;
  } else {
    config.messaging = { topics: updatedTopics };
  }
  saveFrameworkConfig(config);

  logger.success(`Removed topic "${name}" from config`);
  logger.newline();

  // Run sync
  logger.info('Running sync...');
  logger.newline();

  try {
    sync();
  } catch (error) {
    logger.warn(
      `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    logger.info('You may need to run "npx tsdevstack sync" manually.');
  }

  logger.newline();
  logger.success(`Topic "${name}" removed successfully`);
  logger.newline();
}
