/**
 * Generate a random base64-encoded secret
 */

import * as crypto from 'crypto';

/**
 * Generate a random base64-encoded secret
 * Used for: AUTH_SECRET, REFRESH_TOKEN_SECRET
 *
 * @param bytes - Number of random bytes (default: 32)
 * @returns Base64-encoded random string
 */
export function generateBase64Secret(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('base64');
}