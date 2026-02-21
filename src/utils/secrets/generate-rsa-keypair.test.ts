import { describe, it, expect } from '@rstest/core';
import { generateRSAKeyPair } from './generate-rsa-keypair';

describe('generateRSAKeyPair', () => {
  it('should generate RSA key pair with private key, public key, and key ID', () => {
    const result = generateRSAKeyPair();

    expect(result).toHaveProperty('privateKey');
    expect(result).toHaveProperty('publicKey');
    expect(result).toHaveProperty('keyId');

    expect(typeof result.privateKey).toBe('string');
    expect(typeof result.publicKey).toBe('string');
    expect(typeof result.keyId).toBe('string');
  });

  it('should generate private key in PEM format (PKCS8)', () => {
    const { privateKey } = generateRSAKeyPair();

    expect(privateKey).toContain('-----BEGIN PRIVATE KEY-----');
    expect(privateKey).toContain('-----END PRIVATE KEY-----');
  });

  it('should generate public key in PEM format (SPKI)', () => {
    const { publicKey } = generateRSAKeyPair();

    expect(publicKey).toContain('-----BEGIN PUBLIC KEY-----');
    expect(publicKey).toContain('-----END PUBLIC KEY-----');
  });

  it('should generate key ID in YYYY-MM-DD-key-1 format', () => {
    const { keyId } = generateRSAKeyPair();

    // Format: YYYY-MM-DD-key-1
    expect(keyId).toMatch(/^\d{4}-\d{2}-\d{2}-key-1$/);

    // Verify it contains today's date
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const expectedPrefix = `${year}-${month}-${day}`;

    expect(keyId).toContain(expectedPrefix);
  });

  it('should generate different keys on each call', () => {
    const first = generateRSAKeyPair();
    const second = generateRSAKeyPair();

    // Keys should be different
    expect(first.privateKey).not.toBe(second.privateKey);
    expect(first.publicKey).not.toBe(second.publicKey);

    // Key IDs should be the same (both generated on same day)
    expect(first.keyId).toBe(second.keyId);
  });

  it('should generate keys with sufficient length', () => {
    const { privateKey, publicKey } = generateRSAKeyPair();

    // RSA 2048-bit keys in PEM format should be relatively long
    // Private key should be longer than public key
    expect(privateKey.length).toBeGreaterThan(1000);
    expect(publicKey.length).toBeGreaterThan(300);
    expect(privateKey.length).toBeGreaterThan(publicKey.length);
  });

  it('should generate valid PEM format with proper newlines', () => {
    const { privateKey, publicKey } = generateRSAKeyPair();

    // PEM format includes trailing newline from crypto module
    expect(privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----\n/);
    expect(privateKey).toMatch(/-----END PRIVATE KEY-----\n$/);
    expect(publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----\n/);
    expect(publicKey).toMatch(/-----END PUBLIC KEY-----\n$/);

    // Should have newlines between header, content, and footer
    expect(privateKey.split('\n').length).toBeGreaterThan(2);
    expect(publicKey.split('\n').length).toBeGreaterThan(2);
  });
});
