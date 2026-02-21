import { describe, it, expect } from '@rstest/core';
import { generateHexSecret } from './generate-hex-secret';

describe('generateHexSecret', () => {
  it('should generate a hex string with default 32 bytes', () => {
    const secret = generateHexSecret();

    expect(typeof secret).toBe('string');
    // 32 bytes in hex = 64 characters
    expect(secret.length).toBe(64);
  });

  it('should generate a hex string with custom byte size', () => {
    const secret = generateHexSecret(16);

    expect(typeof secret).toBe('string');
    // 16 bytes in hex = 32 characters
    expect(secret.length).toBe(32);
  });

  it('should only contain hex characters', () => {
    const secret = generateHexSecret();
    expect(secret).toMatch(/^[0-9a-f]+$/);
  });

  it('should generate different values on each call', () => {
    const secret1 = generateHexSecret();
    const secret2 = generateHexSecret();

    expect(secret1).not.toBe(secret2);
  });
});
