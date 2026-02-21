import { describe, it, expect } from '@rstest/core';
import { generateBase64Secret } from './generate-base64-secret';

describe('generateBase64Secret', () => {
  it('should generate a base64 string with default 32 bytes', () => {
    const secret = generateBase64Secret();

    expect(typeof secret).toBe('string');
    // 32 bytes in base64 = 44 characters
    expect(secret.length).toBe(44);
  });

  it('should generate a base64 string with custom byte size', () => {
    const secret = generateBase64Secret(16);

    expect(typeof secret).toBe('string');
    // 16 bytes in base64 = 24 characters
    expect(secret.length).toBe(24);
  });

  it('should generate different values on each call', () => {
    const secret1 = generateBase64Secret();
    const secret2 = generateBase64Secret();

    expect(secret1).not.toBe(secret2);
  });
});
