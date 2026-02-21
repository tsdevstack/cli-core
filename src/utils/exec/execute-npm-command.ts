/**
 * Execute npm command in a directory
 */

import { executeCommand, ExecuteCommandOptions } from './execute-command';

/**
 * Execute npm command in a directory
 *
 * Convenience wrapper for npm-specific commands
 *
 * @param script - npm script to run (e.g., "build", "test")
 * @param cwd - Working directory
 * @param options - Additional execution options
 *
 * @example
 * executeNpmCommand("build", "/path/to/package");
 * executeNpmCommand("test", "/path/to/package", { exitOnError: false });
 */
export function executeNpmCommand(
  script: string,
  cwd: string,
  options: Omit<ExecuteCommandOptions, 'cwd'> = {}
): string | void {
  return executeCommand(`npm run ${script}`, {
    ...options,
    cwd,
  });
}