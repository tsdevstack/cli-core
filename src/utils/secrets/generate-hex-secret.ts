/**
 * Generate a random hex-encoded secret
 */

import * as crypto from 'crypto';

/**
 * Generate a random hex-encoded secret
 * Used for: API_KEY, tokens
 *
 * @param bytes - Number of random bytes (default: 32)
 * @returns Hex-encoded random string
 */
export function generateHexSecret(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}
