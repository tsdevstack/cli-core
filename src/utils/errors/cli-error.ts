/**
 * CLI Error Class
 *
 * Reusable error class for all CLI operations.
 * Provides formatted error messages with context and hints for users.
 */

import { logger } from '../logger';

/**
 * CLI error with helpful message and formatting
 */
export class CliError extends Error {
  /**
   * @param message - The core error message
   * @param context - Where the error occurred (e.g., "Invalid service name")
   * @param hint - Optional hint about how to fix it
   */
  constructor(
    message: string,
    public context?: string,
    public hint?: string
  ) {
    super(message);
    this.name = 'CliError';
  }

  /**
   * Format the error for display with context and hint
   * Note: No icon here - logger.error() already adds one
   */
  format(): string {
    let output = this.context ? `${this.context}:\n\n` : '';
    output += this.message;
    if (this.hint) {
      output += `\n\n${this.hint}`;
    }
    return output;
  }

  /**
   * Log the formatted error to console and exit
   */
  logAndExit(exitCode: number = 1): never {
    logger.error(this.format());
    process.exit(exitCode);
  }
}