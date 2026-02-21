/**
 * Service Name Validation
 *
 * Validates service names according to tsdevstack conventions.
 */

import { CliError } from "../errors";
import { RESERVED_NAMES } from "../../constants/reserved-names";
import { NAME_LENGTH } from "../../constants/name-limits";

/**
 * Validate a service name
 *
 * Service names must:
 * - Be lowercase letters, numbers, hyphens only
 * - Start with a letter
 * - Not start or end with hyphen
 * - Be 2-40 characters long (including -service suffix if present)
 * - Not be a reserved infrastructure name
 * - Not end with -db (reserved for database containers)
 *
 * @param serviceName - The service name to validate (e.g., "auth-service")
 * @throws {CliError} If validation fails
 */
export function validateServiceName(serviceName: string): void {
  // Check for uppercase letters
  if (/[A-Z]/.test(serviceName)) {
    throw new CliError(
      `Service name "${serviceName}" contains uppercase letters.\n` +
        `Service names must be all lowercase.\n` +
        `Example: auth-service, user-management-service`
    );
  }

  // Check for invalid characters
  if (!/^[a-z0-9-]+$/.test(serviceName)) {
    const errors: string[] = [];

    if (/_/.test(serviceName)) {
      errors.push("- Use hyphens instead of underscores");
    }
    if (!/^[a-z0-9-]+$/.test(serviceName)) {
      errors.push("- Only lowercase letters, numbers, and hyphens are allowed");
    }

    throw new CliError(
      `Invalid service name: "${serviceName}"\n` +
        errors.join("\n") +
        `\n\nExample valid names: auth-service, user-management-service, payment-v2-service`
    );
  }

  // Must start with a letter
  if (!/^[a-z]/.test(serviceName)) {
    throw new CliError(
      `Service name "${serviceName}" must start with a letter.\n` +
        `Example: auth-service, user-service`
    );
  }

  // Cannot start or end with hyphen
  if (/^-|-$/.test(serviceName)) {
    throw new CliError(
      `Service name "${serviceName}" cannot start or end with a hyphen.`
    );
  }

  // Check reserved infrastructure names
  const withoutSuffix = serviceName.replace(/-service$/, "");
  const isReserved = RESERVED_NAMES.some(
    (reserved) => reserved === withoutSuffix
  );

  if (isReserved) {
    throw new CliError(
      `Service name "${serviceName}" is reserved for infrastructure.\n` +
        `Reserved names: ${RESERVED_NAMES.join(", ")}\n` +
        `Please choose a different name.`
    );
  }

  // Cannot end with -db (check after removing -service suffix)
  if (withoutSuffix.endsWith("-db")) {
    const withoutDbSuffix = withoutSuffix.replace(/-db$/, "");
    throw new CliError(
      `Service names cannot end with "-db".\n` +
        `The "-db" suffix is reserved for database containers.\n` +
        `Suggested: "${withoutDbSuffix}-service"`
    );
  }

  // Check length
  if (serviceName.length < NAME_LENGTH.MIN_PREFIX) {
    throw new CliError(
      `Service name "${serviceName}" is too short (${serviceName.length} characters).\n` +
        `Minimum: ${NAME_LENGTH.MIN_PREFIX} characters`
    );
  }

  if (serviceName.length > NAME_LENGTH.MAX_TOTAL) {
    throw new CliError(
      `Service name "${serviceName}" is too long (${serviceName.length} characters).\n` +
        `Maximum: ${NAME_LENGTH.MAX_TOTAL} characters\n` +
        `This ensures compatibility with PostgreSQL identifier limits.`
    );
  }
}
