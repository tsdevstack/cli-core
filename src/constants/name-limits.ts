/**
 * Service Name Length Limits
 *
 * Length constraints for service names to ensure compatibility
 * with various systems (PostgreSQL, Kubernetes, etc.).
 */

/**
 * Length limits for service names
 */
export const NAME_LENGTH = {
  /** Minimum length for a service prefix */
  MIN_PREFIX: 2,
  /** Maximum length for a service prefix (without -service suffix) */
  MAX_PREFIX: 33,
  /** Maximum total length including -service suffix */
  MAX_TOTAL: 40, // Ensures compatibility with PostgreSQL identifier limits
} as const;