/**
 * Update Messaging Topic Command
 *
 * Updates publishers and subscribers for an existing messaging topic.
 * Replace semantics: --publishers and --subscribers replace the current list entirely.
 *
 * Usage:
 *   npx tsdevstack update-messaging-topic
 *   npx tsdevstack update-messaging-topic --name user-created --publishers auth-service --subscribers offers-service,notifications-service
 */

import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import {
  loadFrameworkConfig,
  saveFrameworkConfig,
  getNestjsServiceNames,
} from '../utils/config';
import { parseAndValidateServiceList } from '../utils/validation/parse-and-validate-service-list';
import { CliError } from '../utils/errors';
import { sync } from './sync';

export interface UpdateMessagingTopicOptions {
  name?: string;
  publishers?: string;
  subscribers?: string;
}

/**
 * Update publishers and subscribers for a messaging topic
 */
export async function updateMessagingTopic(
  options: UpdateMessagingTopicOptions,
): Promise<void> {
  logger.newline();
  logger.info('Update messaging topic');
  logger.newline();

  const config = loadFrameworkConfig();
  const existingTopics = config.messaging?.topics ?? [];

  if (existingTopics.length === 0) {
    throw new CliError(
      'No messaging topics found in config',
      'update-messaging-topic',
      'Add a topic first with: npx tsdevstack add-messaging-topic',
    );
  }

  const nestjsServices = getNestjsServiceNames(config.services);

  // Resolve topic name
  let topicName = options.name;
  if (!topicName) {
    const { selectedTopic } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedTopic',
        message: 'Select topic to update:',
        choices: existingTopics.map((t) => ({ name: t.name, value: t.name })),
      },
    ]);
    topicName = selectedTopic as string;
  }

  const name = topicName as string;

  // Find existing topic
  const topicIndex = existingTopics.findIndex((t) => t.name === name);
  if (topicIndex === -1) {
    throw new CliError(
      `Topic "${name}" not found in config`,
      'update-messaging-topic',
      `Available topics: ${existingTopics.map((t) => t.name).join(', ')}`,
    );
  }

  const currentTopic = existingTopics[topicIndex];

  // Get publishers (replace semantics)
  let publishers: string[];
  if (options.publishers !== undefined) {
    publishers = parseAndValidateServiceList(
      options.publishers,
      nestjsServices,
      'publishers',
    );
  } else {
    const pubAnswer = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'publishers',
        message: 'Select publishing services:',
        choices: nestjsServices.map((s) => ({
          name: s,
          value: s,
          checked: currentTopic.publishers.includes(s),
        })),
      },
    ]);
    publishers = pubAnswer.publishers;
  }

  // Get subscribers (replace semantics)
  let subscribers: string[];
  if (options.subscribers !== undefined) {
    subscribers = parseAndValidateServiceList(
      options.subscribers,
      nestjsServices,
      'subscribers',
    );
  } else {
    const subAnswer = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'subscribers',
        message: 'Select subscribing services:',
        choices: nestjsServices.map((s) => ({
          name: s,
          value: s,
          checked: currentTopic.subscribers.includes(s),
        })),
      },
    ]);
    subscribers = subAnswer.subscribers;
  }

  // Update config
  existingTopics[topicIndex] = {
    name,
    publishers,
    subscribers,
  };
  config.messaging = { topics: existingTopics };
  saveFrameworkConfig(config);

  logger.success(`Updated topic "${name}"`);
  logger.info(
    `  Publishers:  ${publishers.length > 0 ? publishers.join(', ') : '(none)'}`,
  );
  logger.info(
    `  Subscribers: ${subscribers.length > 0 ? subscribers.join(', ') : '(none)'}`,
  );
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
  logger.success(`Topic "${name}" updated successfully`);
  logger.newline();
}
