/**
 * Validate service exists in framework config
 *
 * Checks: service is registered in .tsdevstack/config.json
 *
 * @throws {CliError} if service not found in config
 */

import { CliError } from '../errors';
import { serviceExists } from '../config';

export function validateServiceExistsInConfig(serviceName: string): void {
  if (!serviceExists(serviceName)) {
    throw new CliError(
      `Service "${serviceName}" not found in framework config`,
      'Service not registered',
      'Run this command from the service directory or ensure the service is registered in .tsdevstack/config.json'
    );
  }
}