import { describe, it, expect } from '@rstest/core';
import { getSecretScope } from './get-secret-scope';
import type { FrameworkConfig } from '../config';

function makeConfig(
  template: 'fullstack-auth' | 'auth' | null,
): FrameworkConfig {
  return {
    project: { name: 'shop', version: '1.0.0' },
    cloud: { provider: 'gcp' },
    services: [],
    framework: { template },
  } as FrameworkConfig;
}

describe('getSecretScope', () => {
  describe('Standard use cases', () => {
    it('should put the auth secrets in the auth-service scope', () => {
      const config = makeConfig('fullstack-auth');

      for (const key of [
        'JWT_PRIVATE_KEY_CURRENT',
        'JWT_PUBLIC_KEY_CURRENT',
        'JWT_KEY_ID_CURRENT',
        'JWT_PRIVATE_KEY_PREVIOUS',
        'REFRESH_TOKEN_SECRET',
        'BCRYPT_ROUNDS',
        'ADMIN_EMAILS',
      ]) {
        expect(getSecretScope(key, config)).toBe('auth-service');
      }
    });

    it('should put every other secret in the shared scope', () => {
      const config = makeConfig('fullstack-auth');

      expect(getSecretScope('KONG_TRUST_TOKEN', config)).toBe('shared');
      expect(getSecretScope('AUTH_SERVICE_API_KEY', config)).toBe('shared');
      expect(getSecretScope('ACCESS_TOKEN_TTL', config)).toBe('shared');
      expect(getSecretScope('STRIPE_KEY', config)).toBe('shared');
    });

    it('should use the auth-service scope with the auth template', () => {
      expect(getSecretScope('ADMIN_EMAILS', makeConfig('auth'))).toBe(
        'auth-service',
      );
    });
  });

  describe('Edge cases', () => {
    it('should keep every secret shared without the auth template', () => {
      expect(getSecretScope('ADMIN_EMAILS', makeConfig(null))).toBe('shared');
      expect(getSecretScope('JWT_PRIVATE_KEY_CURRENT', makeConfig(null))).toBe(
        'shared',
      );
    });
  });
});
