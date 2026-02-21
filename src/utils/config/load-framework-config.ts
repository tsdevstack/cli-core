/**
 * Load framework configuration from .tsdevstack/config.json
 */

import { readJsonFile } from '../fs';
import { CliError } from '../errors';
import { getConfigPath } from '../paths';
import type { FrameworkConfig } from './types';

/**
 * Load framework configuration from .tsdevstack/config.json
 *
 * Automatically finds the project root and loads the config.
 *
 * @returns Framework configuration object
 * @throws {CliError} If configuration file is not found
 */
export function loadFrameworkConfig(): FrameworkConfig {
  const configPath = getConfigPath();

  try {
    return readJsonFile<FrameworkConfig>(configPath);
  } catch {
    throw new CliError(
      'Expected .tsdevstack/config.json in project root.',
      'Framework configuration not found',
      'Make sure you are running this command from within a tsdevstack project.',
    );
  }
}
