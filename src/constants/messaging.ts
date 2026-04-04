/**
 * Messaging Constants
 *
 * Topic name limits and reserved names for async messaging.
 */

/** Maximum length for a topic name */
export const TOPIC_NAME_MAX_LENGTH = 50;

/** Reserved names that cannot be used as topic names */
export const TOPIC_RESERVED_NAMES = [
  'dlq',
  'messaging',
  'bull',
  'redis',
  'gateway',
  'kong',
] as const;
