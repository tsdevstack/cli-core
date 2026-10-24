/**
 * Prompt constants
 */

/**
 * Name of the error inquirer throws when a prompt's input closes: Ctrl+C in a
 * terminal, or a closed stdin when nothing can answer (CI, agents)
 */
export const PROMPT_CLOSED_ERROR_NAME = 'ExitPromptError';

/**
 * Exit code for a command the user cancelled with Ctrl+C (128 + SIGINT)
 */
export const CANCELLED_EXIT_CODE = 130;
