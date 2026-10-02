import { describe, it, expect } from '@rstest/core';
import { resolveGlobalPrefix } from './resolve-global-prefix';

describe('resolveGlobalPrefix', () => {
  describe('Standard use cases', () => {
    it('should use the configured globalPrefix', () => {
      expect(
        resolveGlobalPrefix({ name: 'offers-service', globalPrefix: 'deals' }),
      ).toBe('deals');
    });

    it('should strip -service from the name when no globalPrefix is set', () => {
      expect(resolveGlobalPrefix({ name: 'offers-service' })).toBe('offers');
      expect(resolveGlobalPrefix({ name: 'user-auth-service' })).toBe(
        'user-auth',
      );
    });
  });

  describe('Edge cases', () => {
    it('should keep names without -service unchanged', () => {
      expect(resolveGlobalPrefix({ name: 'billing' })).toBe('billing');
    });

    it('should fall back to the name rule when globalPrefix is empty', () => {
      expect(
        resolveGlobalPrefix({ name: 'offers-service', globalPrefix: '' }),
      ).toBe('offers');
    });
  });
});
