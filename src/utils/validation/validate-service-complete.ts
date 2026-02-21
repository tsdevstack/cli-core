/**
 * Complete service validation - runs ALL checks
 *
 * Validates:
 * 1. Service name format
 * 2. Service exists in config
 * 3. Service folder exists
 * 4. Package.json exists
 * 5. Folder name matches service name
 * 6. Package.json name matches service name
 *
 * @param serviceName - The service name to validate
 * @param collectErrors - If true, collects all errors; if false, throws on first error
 * @throws {CliError} with all validation errors
 */

import { CliError } from '../errors';
import { validateServiceName } from './validate-service-name';
import { validateServiceExistsInConfig } from './validate-service-exists-in-config';
import { validateServiceFolderExists } from './validate-service-folder-exists';
import { validateServicePackageJsonExists } from './validate-service-package-json-exists';
import { validateFolderNameMatchesService } from './validate-folder-name-matches-service';
import { validatePackageJsonNameMatchesService } from './validate-package-json-name-matches-service';

export function validateServiceComplete(
  serviceName: string,
  collectErrors: boolean = false
): void {
  if (!collectErrors) {
    // Fail fast mode - throw on first error
    validateServiceName(serviceName);
    validateServiceExistsInConfig(serviceName);
    validateServiceFolderExists(serviceName);
    validateServicePackageJsonExists(serviceName);
    validateFolderNameMatchesService(serviceName);
    validatePackageJsonNameMatchesService(serviceName);
    return;
  }

  // Collect all errors mode
  const errors: CliError[] = [];

  try {
    validateServiceName(serviceName);
  } catch (error) {
    if (error instanceof CliError) errors.push(error);
  }

  try {
    validateServiceExistsInConfig(serviceName);
  } catch (error) {
    if (error instanceof CliError) errors.push(error);
  }

  try {
    validateServiceFolderExists(serviceName);
  } catch (error) {
    if (error instanceof CliError) errors.push(error);
  }

  try {
    validateServicePackageJsonExists(serviceName);
  } catch (error) {
    if (error instanceof CliError) errors.push(error);
  }

  try {
    validateFolderNameMatchesService(serviceName);
  } catch (error) {
    if (error instanceof CliError) errors.push(error);
  }

  try {
    validatePackageJsonNameMatchesService(serviceName);
  } catch (error) {
    if (error instanceof CliError) errors.push(error);
  }

  if (errors.length > 0) {
    const errorMessages = errors
      .map((e, i) => `${i + 1}. ${e.message}`)
      .join('\n\n');

    throw new CliError(
      errorMessages,
      `Service validation failed with ${errors.length} error(s)`,
      'Fix all issues above and run validation again'
    );
  }
}