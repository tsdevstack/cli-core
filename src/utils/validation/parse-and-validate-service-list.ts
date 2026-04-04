/**
 * Parse and Validate Service List
 *
 * Parses a comma-separated service list and validates each name exists
 * in the provided list of valid NestJS services.
 */

import { CliError } from '../errors';

export function parseAndValidateServiceList(
  input: string,
  nestjsServices: string[],
  label: string,
): string[] {
  const names = input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const name of names) {
    if (!nestjsServices.includes(name)) {
      throw new CliError(
        `Service "${name}" is not a valid NestJS service for ${label}.\n` +
          `Available NestJS services: ${nestjsServices.join(', ')}`,
      );
    }
  }

  return names;
}
