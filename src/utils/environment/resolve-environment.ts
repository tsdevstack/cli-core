/**
 * Resolve Target Environment
 *
 * Shared utility for resolving which environment to target.
 * Used by multiple CLI commands across plugins.
 */

import inquirer from 'inquirer';
import { logger } from '../logger';
import { CliError } from '../errors';
import { isCIEnv } from '../ci';

interface ResolveEnvironmentOptions {
  env?: string;
}

/**
 * Resolve target environment from options, env var, or prompt
 *
 * Resolution order:
 * 1. --env flag
 * 2. TARGET_ENV env var
 * 3. CI mode: error (must be explicit)
 * 4. Local mode: auto-select if only one env
 * 5. Local mode: prompt user to select
 */
export async function resolveEnvironment(
  options: ResolveEnvironmentOptions,
  availableEnvs: string[],
  commandName: string
): Promise<string> {
  // 1. --env flag provided
  if (options.env) {
    // In local mode, validate against available envs
    if (!isCIEnv() && availableEnvs.length > 0 && !availableEnvs.includes(options.env)) {
      throw new CliError(
        `Environment '${options.env}' not found in credentials`,
        commandName,
        `Available environments: ${availableEnvs.join(', ')}`
      );
    }
    return options.env;
  }

  // 2. TARGET_ENV env var
  const targetEnvVar = process.env.TARGET_ENV;
  if (targetEnvVar) {
    if (!isCIEnv() && availableEnvs.length > 0 && !availableEnvs.includes(targetEnvVar)) {
      throw new CliError(
        `Environment '${targetEnvVar}' (from TARGET_ENV) not found in credentials`,
        commandName,
        `Available environments: ${availableEnvs.join(', ')}`
      );
    }
    return targetEnvVar;
  }

  // 3. CI mode - error if no env specified
  if (isCIEnv()) {
    throw new CliError(
      'No environment specified in CI',
      commandName,
      'Set --env flag or TARGET_ENV environment variable'
    );
  }

  // 4. Local mode - auto-select if only one env
  if (availableEnvs.length === 1) {
    logger.info(`Using environment: ${availableEnvs[0]}`);
    return availableEnvs[0];
  }

  // 5. Local mode - prompt user to select
  if (availableEnvs.length === 0) {
    throw new CliError(
      'No environments available',
      commandName,
      'Configure credentials first with: npx tsdevstack cloud:init'
    );
  }

  logger.info(`Available environments: ${availableEnvs.join(', ')}`);
  logger.newline();

  const { selectedEnv } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedEnv',
      message: 'Select target environment:',
      choices: availableEnvs.map((env) => ({
        name: env,
        value: env,
      })),
    },
  ]);

  return selectedEnv;
}