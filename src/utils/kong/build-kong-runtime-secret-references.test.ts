import { describe, it, expect } from '@rstest/core';
import { buildKongRuntimeSecretReferences } from './build-kong-runtime-secret-references';

describe('buildKongRuntimeSecretReferences', () => {
  describe('Standard use cases', () => {
    it('should reference each runtime secret in the env vault', () => {
      expect(buildKongRuntimeSecretReferences()).toEqual({
        REDIS_PASSWORD: '{vault://env/redis-password}',
        KONG_TRUST_TOKEN: '{vault://env/kong-trust-token}',
        KONG_FRONTEND_TOKEN: '{vault://env/kong-frontend-token}',
      });
    });
  });

  describe('Edge cases', () => {
    it('should name the variable the env vault reads back (upper case, _ for -)', () => {
      for (const [key, reference] of Object.entries(
        buildKongRuntimeSecretReferences(),
      )) {
        const resource = reference.slice('{vault://env/'.length, -1);
        expect(resource.toUpperCase().replace(/-/g, '_')).toBe(key);
      }
    });
  });
});
