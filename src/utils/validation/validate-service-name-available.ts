/**
 * Validate service name is available (for creating new services)
 *
 * Validates:
 * 1. Service name format is valid
 * 2. Service does NOT exist in config
 * 3. Service folder does NOT exist
 *
 * @param serviceName - The service name to check
 * @throws {CliError} if service name is not available
 */

import * as fs from 'fs';
import { CliError } from '../errors';
import { validateServiceName } from './validate-service-name';
import { serviceExists } from '../config';
import { getServicePath } from '../paths/index';

export function validateServiceNameAvailable(serviceName: string): void {
  // Check name format
  validateServiceName(serviceName);

  // Check doesn't exist in config
  if (serviceExists(serviceName)) {
    throw new CliError(
      `Service "${serviceName}" already exists in framework config`,
      'Service name unavailable',
      'Choose a different service name or remove the existing service first'
    );
  }

  // Check folder doesn't exist
  const servicePath = getServicePath(serviceName);
  if (fs.existsSync(servicePath)) {
    throw new CliError(
      `Service folder already exists: ${servicePath}`,
      'Service folder already exists',
      'Choose a different service name or remove the existing folder first'
    );
  }
}