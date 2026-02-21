/**
 * Global Prefix Validation
 *
 * Validates global URL prefixes for API routes.
 */

import { CliError } from "../errors";
import { validateServiceName } from "./validate-service-name";
import { RESERVED_PREFIXES } from "../../constants/reserved-prefixes";

/**
 * Validate a global prefix for URL safety
 *
 * Similar to validateServiceName but also checks against reserved URL prefixes.
 *
 * @param prefix - The global prefix to validate
 * @throws {CliError} If validation fails
 */
export function validateGlobalPrefix(prefix: string): void {
  // First do standard validation (but prefix doesn't need -service suffix)
  validateServiceName(prefix);

  // Check reserved URL prefixes
  const isReservedPrefix = RESERVED_PREFIXES.some(
    (reserved) => reserved === prefix
  );

  if (isReservedPrefix) {
    throw new CliError(
      `Global prefix "${prefix}" is reserved.\n` +
        `Reserved prefixes: ${RESERVED_PREFIXES.join(", ")}\n` +
        `Please choose a different name.`
    );
  }
}
