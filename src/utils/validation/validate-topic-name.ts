/**
 * Topic Name Validation
 *
 * Validates topic names for messaging commands.
 */

import { CliError } from '../errors';
import {
  TOPIC_NAME_MAX_LENGTH,
  TOPIC_RESERVED_NAMES,
  NAME_LENGTH,
} from '../../constants';
import type { FrameworkConfig } from '../config';

/**
 * Validate a messaging topic name
 *
 * Topic names must:
 * - Be kebab-case: /^[a-z][a-z0-9-]*[a-z0-9]$/ (min 2 chars)
 * - Max 50 chars
 * - Not be a reserved name
 * - Not be a duplicate in existing config.messaging.topics
 *
 * @param name - The topic name to validate
 * @param config - Framework config (for existing topics)
 * @throws {CliError} If validation fails
 */
export function validateTopicName(name: string, config: FrameworkConfig): void {
  // Check for uppercase letters
  if (/[A-Z]/.test(name)) {
    throw new CliError(
      `Topic name "${name}" contains uppercase letters.\n` +
        'Topic names must be all lowercase.\n' +
        'Example: user-created, offer-accepted',
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
      `Invalid topic name: "${name}"\n` +
        errors.join('\n') +
        '\n\nExample valid names: user-created, offer-accepted, payment-processed',
    );
  }

  // Must start with a letter
  if (!/^[a-z]/.test(name)) {
    throw new CliError(
      `Topic name "${name}" must start with a letter.\n` +
        'Example: user-created, offer-accepted',
    );
  }

  // Cannot start or end with hyphen
  if (/^-|-$/.test(name)) {
    throw new CliError(
      `Topic name "${name}" cannot start or end with a hyphen.`,
    );
  }

  // Minimum length
  if (name.length < NAME_LENGTH.MIN_PREFIX) {
    throw new CliError(
      `Topic name "${name}" is too short (${name.length} character).\n` +
        `Minimum: ${NAME_LENGTH.MIN_PREFIX} characters`,
    );
  }

  // Maximum length
  if (name.length > TOPIC_NAME_MAX_LENGTH) {
    throw new CliError(
      `Topic name "${name}" is too long (${name.length} characters).\n` +
        `Maximum: ${TOPIC_NAME_MAX_LENGTH} characters`,
    );
  }

  // Check reserved names
  const isReserved = TOPIC_RESERVED_NAMES.some((reserved) => reserved === name);
  if (isReserved) {
    throw new CliError(
      `Topic name "${name}" is reserved.\n` +
        `Reserved names: ${TOPIC_RESERVED_NAMES.join(', ')}\n` +
        'Please choose a different name.',
    );
  }

  // Check for duplicates in existing topics
  const existingTopics = config.messaging?.topics ?? [];
  if (existingTopics.some((t) => t.name === name)) {
    throw new CliError(
      `Topic "${name}" already exists in config.\n` +
        `Existing topics: ${existingTopics.map((t) => t.name).join(', ')}`,
    );
  }
}
