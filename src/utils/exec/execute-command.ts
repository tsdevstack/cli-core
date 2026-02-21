/**
 * Execute a shell command with logging and error handling
 */

import { execSync, ExecSyncOptions } from 'child_process';
import { logger } from '../logger';

/**
 * Options for command execution
 */
export interface ExecuteCommandOptions {
  /** Working directory for command execution */
  cwd?: string;
  /** Whether to inherit stdio (show command output in real-time) */
  stdio?: 'inherit' | 'pipe' | 'ignore';
  /** Whether to log the command before execution (default: true) */
  logCommand?: boolean;
  /** Whether to exit on error (default: true) */
  exitOnError?: boolean;
  /** Environment variables to pass to the command */
  env?: NodeJS.ProcessEnv;
}

/**
 * Execute a shell command with logging and error handling
 *
 * @param command - The command to execute
 * @param options - Execution options
 * @returns Command output (if stdio is 'pipe'), otherwise void
 *
 * @example
 * executeCommand("npm install", { cwd: "/path/to/dir" });
 * executeCommand("npm run build", { logPrefix: "🔨", exitOnError: true });
 */
export function executeCommand(
  command: string,
  options: ExecuteCommandOptions = {},
): string | void {
  const {
    cwd,
    stdio = 'inherit',
    logCommand = true,
    exitOnError = true,
    env,
  } = options;

  if (logCommand) {
    logger.running(`Running: ${command}`);
    if (cwd) {
      logger.info(`   Working directory: ${cwd}`);
    }
    logger.newline();
  }

  const execOptions: ExecSyncOptions = {
    stdio,
    cwd,
    encoding: 'utf-8',
    env: env ? { ...process.env, ...env } : process.env,
  };

  try {
    const output = execSync(command, execOptions);
    return stdio === 'pipe' ? (output as string) : undefined;
  } catch (error) {
    logger.error(`Error executing command: ${command}`);
    if (error instanceof Error) {
      logger.error(error.message);
    }

    if (exitOnError) {
      process.exit(1);
    } else {
      throw error;
    }
  }
}
