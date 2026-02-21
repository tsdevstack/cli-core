/**
 * Framework constants barrel export
 *
 * This file re-exports all constants from their domain-specific files
 * to maintain backward compatibility with existing imports.
 */

// Path and directory constants
export * from './paths';

// Secrets constants
export * from './secrets';

// Service type constants
export * from './service-types';

// Local development constants
export * from './local-dev';

// Name validation constants
export * from './name-limits';
export * from './reserved-names';
export * from './reserved-prefixes';

// Cloud constants
export * from './cloud-providers';

// CI/CD environment variables
export * from './ci-env-vars';

// Database tiers (per provider)
export * from './gcp-database-tiers';
export * from './aws-database-tiers';
export * from './azure-database-tiers';

// Template repositories
export * from './templates';

// Kong Gateway constants
export * from './kong';

// HTTP constants
export * from './http';
