import type { SecretsFile } from './types.js';

/**
 * Generate example secrets file by stripping all values
 *
 * This creates a .secrets.user.example.json file that can be committed to git,
 * showing the structure of user secrets without exposing actual values.
 */
export function generateUserSecretsExample(
  userSecrets: SecretsFile,
): SecretsFile {
  // Deep clone to avoid mutating original
  const example: SecretsFile = JSON.parse(JSON.stringify(userSecrets));

  // Strip values recursively
  stripValues(example);

  // Update comment to explain usage
  example.$comment =
    'Example user secrets - copy values to .secrets.user.json or run: npx tsdevstack generate-secrets';

  return example;
}

/**
 * Recursively strip all string values from an object, replacing with empty strings
 * Preserves structure, arrays, and metadata fields (starting with $)
 */
function stripValues(obj: Record<string, unknown>): void {
  for (const key in obj) {
    // Skip metadata fields
    if (key.startsWith('$')) {
      continue;
    }

    const value = obj[key];

    if (typeof value === 'string') {
      // Replace string values with empty strings
      obj[key] = '';
    } else if (Array.isArray(value)) {
      // Keep arrays as-is (like secrets: ["KEY1", "KEY2"])
      // These are references, not values
      continue;
    } else if (typeof value === 'object' && value !== null) {
      // Recurse into nested objects
      stripValues(value as Record<string, unknown>);
    }
  }
}