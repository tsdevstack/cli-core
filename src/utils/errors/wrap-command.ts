/**
 * Command wrapper for centralized error handling
 *
 * Wraps CLI command functions to catch and format errors consistently.
 */

import { logger } from '../logger';
import { CliError } from './cli-error';

/**
 * Wrap a command function with error handling
 *
 * Catches errors thrown by commands and displays them in a user-friendly way.
 * CliError instances are formatted and displayed with context and hints.
 * Unknown errors are logged with their stack trace for debugging.
 */

// Overload: no parameters
export function wrapCommand(
  commandFn: () => Promise<void>,
): () => Promise<void>;

// Overload: one parameter
export function wrapCommand<T1>(
  commandFn: (arg1: T1) => Promise<void>,
): (arg1: T1) => Promise<void>;

// Overload: two parameters
export function wrapCommand<T1, T2>(
  commandFn: (arg1: T1, arg2: T2) => Promise<void>,
): (arg1: T1, arg2: T2) => Promise<void>;

// Overload: three parameters
export function wrapCommand<T1, T2, T3>(
  commandFn: (arg1: T1, arg2: T2, arg3: T3) => Promise<void>,
): (arg1: T1, arg2: T2, arg3: T3) => Promise<void>;

// Implementation
export function wrapCommand(
  commandFn: (...args: unknown[]) => Promise<void>,
): (...args: unknown[]) => Promise<void> {
  return async (...args: unknown[]) => {
    try {
      await commandFn(...args);
    } catch (error) {
      if (error instanceof CliError) {
        error.logAndExit(1);
      } else {
        logger.error('Unexpected error occurred:');
        logger.error(error instanceof Error ? error.message : String(error));
        // Show hint/context from InfraCoreError or similar structured errors
        const structured = error as { hint?: string; context?: string };
        if (structured.hint) {
          logger.error(structured.hint);
        }
        if (error instanceof Error && error.stack) {
          logger.debug(error.stack);
        }
        process.exit(1);
      }
    }
  };
}
