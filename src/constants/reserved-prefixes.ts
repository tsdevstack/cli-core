/**
 * Reserved URL Prefixes
 *
 * URL prefixes that cannot be used as global prefixes for API routes.
 */

/**
 * Reserved URL prefixes that cannot be used as global prefixes
 */
export const RESERVED_PREFIXES = [
  'api',
  'admin',
  'health',
  'metrics',
  'docs',
  'swagger',
  'graphql',
  'websocket',
  'ws',
  'public',
  'static',
  'assets',
] as const;

/**
 * Type helper for reserved prefixes
 */
export type ReservedPrefix = (typeof RESERVED_PREFIXES)[number];