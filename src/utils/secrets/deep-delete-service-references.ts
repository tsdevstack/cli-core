/**
 * Deep delete utility for removing service references throughout any JSON structure
 *
 * This utility recursively traverses objects, arrays, and primitives to remove
 * service references in both keys and values. It handles the uppercase conversion
 * (kebab-case → SCREAMING_SNAKE_CASE) automatically.
 *
 * @example
 * // Removes "demo-service" from the entire structure
 * const { modified, result } = deepDeleteServiceReferences(userSecrets, 'demo-service');
 * // Removes keys: DEMO_SERVICE_API_KEY, demo-service section
 * // Removes values containing: "DEMO_SERVICE_API_KEY"
 */

import { toScreamingSnakeCase } from './to-screaming-snake-case';

/**
 * Result of a deep delete operation
 */
export interface DeepDeleteResult {
  /** Whether any changes were made */
  modified: boolean;
  /** The transformed result */
  result: unknown;
}

/**
 * Recursively delete service references from any JSON structure
 *
 * @param obj - The object/array/primitive to process
 * @param serviceName - Service name to remove (kebab-case, e.g., "demo-service")
 * @returns Object with `modified` flag and transformed `result`
 */
export function deepDeleteServiceReferences(
  obj: unknown,
  serviceName: string
): DeepDeleteResult {
  // Convert service name to uppercase (SCREAMING_SNAKE_CASE)
  const upperName = toScreamingSnakeCase(serviceName);

  let modified = false;

  /**
   * Recursive helper function
   */
  function processValue(value: unknown): unknown {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Handle strings - remove if it contains uppercase service name
    if (typeof value === 'string') {
      if (value.includes(upperName)) {
        modified = true;
        return undefined; // Remove the value
      }
      return value;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      const newArray = value
        .map(item => processValue(item))
        .filter(item => item !== undefined);
      return newArray;
    }

    // Handle objects
    if (typeof value === 'object') {
      const newObj: Record<string, unknown> = {};

      for (const key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          continue;
        }

        const originalValue = (value as Record<string, unknown>)[key];

        // Skip if key is the service name (exact match for service sections)
        if (key === serviceName) {
          modified = true;
          continue;
        }

        // Skip if key starts with service name in uppercase (e.g., DEMO_SERVICE_API_KEY)
        if (key.startsWith(upperName + '_')) {
          modified = true;
          continue;
        }

        // Recursively process the value
        const processedValue = processValue(originalValue);

        // Only keep the key if the processed value is not undefined
        if (processedValue !== undefined) {
          newObj[key] = processedValue;
        } else {
          modified = true;
        }
      }

      return newObj;
    }

    // Handle primitives (numbers, booleans, etc.)
    return value;
  }

  const result = processValue(obj);

  return {
    modified,
    result,
  };
}