/**
 * Add Messaging Topic Command
 *
 * Adds a messaging topic to the project config and runs sync.
 *
 * Usage:
 *   npx tsdevstack add-messaging-topic
 *   npx tsdevstack add-messaging-topic --name user-created --publishers auth-service --subscribers offers-service,notifications-service
 */

import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import {
  loadFrameworkConfig,
  saveFrameworkConfig,
  getNestjsServiceNames,
} from '../utils/config';
import { validateTopicName } from '../utils/validation/validate-topic-name';
import { parseAndValidateServiceList } from '../utils/validation/parse-and-validate-service-list';
import { CliError } from '../utils/errors';
import { sync } from './sync';

export interface AddMessagingTopicOptions {
  name?: string;
  publishers?: string;
  subscribers?: string;
}

/**
 * Add a messaging topic to the project
 */
export async function addMessagingTopic(
  options: AddMessagingTopicOptions,
): Promise<void> {
  logger.newline();
  logger.info('Add messaging topic to your project');
  logger.newline();

  const config = loadFrameworkConfig();
  const nestjsServices = getNestjsServiceNames(config.services);

  if (nestjsServices.length === 0) {
    throw new CliError(
      'No NestJS services found in config.\n' +
        'Add at least one NestJS service before creating messaging topics.',
      'add-messaging-topic',
    );
  }

  // Get topic name
  let topicName = options.name;
  if (!topicName) {
    const nameAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Topic name (kebab-case):',
        validate: (input: string) => {
          try {
            validateTopicName(input, config);
            return true;
          } catch (error) {
            if (error instanceof Error) {
              return error.message;
            }
            return 'Invalid topic name';
          }
        },
      },
    ]);
    topicName = nameAnswer.name;
  } else {
    validateTopicName(topicName, config);
  }

  const name = topicName as string;

  // Get publishers
  let publishers: string[] = [];
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
        choices: nestjsServices.map((s) => ({ name: s, value: s })),
      },
    ]);
    publishers = pubAnswer.publishers;
  }

  // Get subscribers
  let subscribers: string[] = [];
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
        choices: nestjsServices.map((s) => ({ name: s, value: s })),
      },
    ]);
    subscribers = subAnswer.subscribers;
  }

  // Update config
  if (!config.messaging) {
    config.messaging = { topics: [] };
  }
  config.messaging.topics.push({
    name,
    publishers,
    subscribers,
  });
  saveFrameworkConfig(config);

  logger.success(`Added topic "${name}" to config`);
  if (publishers.length > 0) {
    logger.info(`  Publishers:  ${publishers.join(', ')}`);
  }
  if (subscribers.length > 0) {
    logger.info(`  Subscribers: ${subscribers.join(', ')}`);
  }
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
  logger.success(`Topic "${name}" added successfully`);
  logger.newline();
}
