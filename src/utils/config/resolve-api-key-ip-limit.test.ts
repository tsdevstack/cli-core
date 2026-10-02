import { describe, it, expect } from '@rstest/core';
import { resolveApiKeyIpLimit } from './resolve-api-key-ip-limit';
import type { FrameworkConfig } from './types';

function withLimit(value: unknown): Pick<FrameworkConfig, 'framework'> {
  return {
    framework: { apiKeys: { ipLimitPerMinute: value as number } },
  };
}

describe('resolveApiKeyIpLimit', () => {
  describe('Standard use cases', () => {
    it('should default to 600 without framework.apiKeys', () => {
      expect(resolveApiKeyIpLimit({})).toBe(600);
      expect(resolveApiKeyIpLimit({ framework: {} })).toBe(600);
      expect(resolveApiKeyIpLimit({ framework: { apiKeys: {} } })).toBe(600);
    });

    it('should use the configured value', () => {
      expect(resolveApiKeyIpLimit(withLimit(120))).toBe(120);
      expect(resolveApiKeyIpLimit(withLimit(1))).toBe(1);
    });
  });

  describe('Invalid values', () => {
    it.each([0, -5, 1.5, '600', null, Number.NaN])(
      'should reject %s',
      (value) => {
        expect(() => resolveApiKeyIpLimit(withLimit(value))).toThrow(
          'framework.apiKeys.ipLimitPerMinute must be a positive integer',
        );
      },
    );
  });
});
