/**
 * Service Name Resolution
 *
 * Resolves service name from argument, current directory, or interactive selector.
 */

import inquirer from 'inquirer';
import { readPackageJson } from '../fs/index';
import { loadFrameworkConfig } from '../config';
import { logger } from '../logger';

/**
 * Resolve service name from argument, current directory, or interactive selector
 *
 * Resolution order:
 * 1. If serviceName argument provided → use it
 * 2. If current directory has package.json with a registered service name → use it
 * 3. Otherwise → show interactive service selector
 *
 * @param serviceName - Optional service name argument
 * @returns Resolved service name
 */
export async function resolveServiceNameInteractive(serviceName?: string): Promise<string> {
  // 1. If service name provided as argument, use it
  if (serviceName) {
    return serviceName;
  }

  // Load framework config once (needed for both detection and selector)
  const config = loadFrameworkConfig();

  // 2. Try to detect from current directory's package.json
  // Only use it if it's actually a registered service
  try {
    const packageJson = readPackageJson();
    const isService = config.services.some((s) => s.name === packageJson.name);

    if (isService) {
      return packageJson.name;
    }
    // If not a service, fall through to interactive selector
  } catch {
    // Not in a directory with package.json, continue to interactive selector
    // This is expected behavior when not in a service directory
  }

  // 3. Show interactive service selector
  const serviceChoices = config.services.map((s) => s.name);

  if (serviceChoices.length === 0) {
    logger.error('No services found in framework config');
    process.exit(1);
  }

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'serviceName',
      message: 'Select service:',
      choices: serviceChoices,
    },
  ]);

  return answer.serviceName;
}