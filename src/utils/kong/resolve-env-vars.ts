/**
 * Resolve ${ENV_VAR} placeholders in Kong configuration
 */

import { logger } from '../logger';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Resolve ${ENV_VAR} placeholders in an object recursively
 */
export function resolveEnvVars(obj: JsonValue, secrets: Record<string, string>): JsonValue {
  if (typeof obj === 'string') {
    // Check if the entire string is a single placeholder (e.g., "${REDIS_PORT}")
    const singlePlaceholderMatch = obj.match(/^\$\{([^}]+)\}$/);
    if (singlePlaceholderMatch) {
      const varName = singlePlaceholderMatch[1];
      const value = secrets[varName];
      if (value === undefined) {
        logger.warn(`${varName} not found in secrets, keeping placeholder`);
        return obj;
      }
      // Try to convert to number if it's a numeric string (for Kong integer fields like port)
      if (/^\d+$/.test(value)) {
        return parseInt(value, 10);
      }
      return value;
    }

    // Replace ${VAR_NAME} with actual value from secrets (for embedded placeholders)
    return obj.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const value = secrets[varName];
      if (value === undefined) {
        logger.warn(`${varName} not found in secrets, keeping placeholder`);
        return match;
      }
      return value;
    });
  }

  if (Array.isArray(obj)) {
    return obj.map(item => resolveEnvVars(item, secrets));
  }

  if (obj && typeof obj === 'object') {
    const resolved: { [key: string]: JsonValue } = {};
    for (const [key, value] of Object.entries(obj)) {
      resolved[key] = resolveEnvVars(value, secrets);
    }
    return resolved;
  }

  return obj;
}