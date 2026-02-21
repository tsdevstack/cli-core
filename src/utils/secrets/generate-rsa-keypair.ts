/**
 * Generate RSA key pair for JWT signing
 */

import { generateKeyPairSync } from 'crypto';

/**
 * Generate RSA key pair for JWT signing
 * @returns Object with private key, public key, and key ID
 */
export function generateRSAKeyPair(): { privateKey: string; publicKey: string; keyId: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  // Generate key ID based on timestamp
  const now = new Date();
  const keyId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-key-1`;

  return { privateKey, publicKey, keyId };
}