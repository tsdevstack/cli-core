/**
 * Package.json type definitions
 */

/**
 * Package.json structure
 */
export interface PackageJson {
  name: string;
  version?: string;
  description?: string;
  author?: string | { name: string };
  [key: string]: unknown; // Allow additional properties
}