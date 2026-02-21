#!/usr/bin/env node

/**
 * Validate Service Command
 *
 * Validates that a service follows tsdevstack conventions and is properly configured.
 *
 * Usage:
 *   npx tsdevstack validate-service [service-name]
 *   npx tsdevstack validate-service auth-service (validate specific service from anywhere)
 *   npx tsdevstack validate-service (auto-detect from current directory or show selector)
 *
 * Performs comprehensive validation:
 * - Service name format
 * - Service registered in config
 * - Service folder exists
 * - package.json exists
 * - Folder name matches service name
 * - package.json name matches service name
 */

import { validateServiceComplete } from '../utils/validation';
import { resolveServiceNameInteractive } from '../utils/service/resolve-service-name-interactive';
import { logger } from '../utils/logger';

/**
 * Validate a service
 */
export async function validateService(serviceName?: string): Promise<void> {
  // Resolve service name
  const resolvedServiceName = await resolveServiceNameInteractive(serviceName);

  // Run complete validation with error collection
  validateServiceComplete(resolvedServiceName, true); // collect all errors
  logger.success(`Service "${resolvedServiceName}" is valid`);
  logger.info('   All checks passed:');
  logger.validating('   Service name format is valid');
  logger.validating('   Service is registered in config');
  logger.validating('   Service folder exists');
  logger.validating('   package.json exists');
  logger.validating('   Folder name matches service name');
  logger.validating('   package.json name matches service name');
}
