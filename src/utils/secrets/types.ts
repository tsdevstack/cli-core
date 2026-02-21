/**
 * TypeScript interfaces for secrets files
 */

/**
 * Flat secrets object - top-level key-value pairs where all values are strings
 * Example: { "AUTH_SERVICE_API_KEY": "3e67d4f0...", "API_URL": "http://..." }
 */
export type Secrets = Record<string, string>;

/**
 * Service section in secrets file
 * Different structure for frontend vs backend services
 */
export interface ServiceSecrets {
  /** Array of secret keys this service needs from global secrets */
  secrets: string[];
  /** API key reference for backend services (e.g., "AUTH_SERVICE_API_KEY") */
  API_KEY?: string;
  /** CORS allowed origins for backend services */
  ALLOWED_ORIGINS?: string;
}

export interface SecretsFile {
  $comment?: string;
  $warning?: string;
  $regenerate?: string;
  $generated_at?: string;
  $instructions?: Record<string, string>;
  $important?: Record<string, string>;
  $do_not_edit?: string;
  $edit_instead?: string;
  $source?: string;
  /** Top-level secrets - flat structure with string values only (no nesting) */
  secrets: Record<string, string>;
  /** Service sections - can be ServiceSecrets or other metadata */
  [serviceName: string]: unknown;
}
