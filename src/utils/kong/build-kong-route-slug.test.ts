import { describe, it, expect } from '@rstest/core';
import { buildKongRouteSlug } from './build-kong-route-slug';

describe('buildKongRouteSlug', () => {
  describe('Standard use cases', () => {
    it('should join segments with dashes', () => {
      expect(buildKongRouteSlug('/offers/v1/user/assign-plan')).toBe(
        'offers-v1-user-assign-plan',
      );
    });

    it('should keep parameter names without braces', () => {
      expect(buildKongRouteSlug('/offers/v1/plans/{id}')).toBe(
        'offers-v1-plans-id',
      );
    });

    it('should replace dots', () => {
      expect(buildKongRouteSlug('/auth/.well-known/jwks.json')).toBe(
        'auth-well-known-jwks-json',
      );
    });
  });

  describe('Edge cases', () => {
    it('should return root for /', () => {
      expect(buildKongRouteSlug('/')).toBe('root');
    });

    it('should only produce characters Kong accepts in names', () => {
      expect(buildKongRouteSlug('/A_B/ü/{x}/v2.1')).toMatch(/^[a-z0-9-]+$/);
    });
  });
});
