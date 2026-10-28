import { describe, it, expect } from '@rstest/core';
import { applySecretScopes } from './apply-secret-scopes';
import type { FrameworkConfig } from '../config';
import type { SecretsFile } from './types';

function makeConfig(template: 'fullstack-auth' | null): FrameworkConfig {
  return {
    project: { name: 'shop', version: '1.0.0' },
    cloud: { provider: null },
    services: [],
    framework: { template },
  } as FrameworkConfig;
}

const merged = (): SecretsFile => ({
  $comment: 'generated',
  secrets: {
    KONG_TRUST_TOKEN: 'trust',
    JWT_PRIVATE_KEY_CURRENT: 'private-key',
    REFRESH_TOKEN_SECRET: 'refresh',
    ADMIN_EMAILS: 'admin@shop.test',
  },
  'auth-service': { PORT: '3001', secrets: ['JWT_PRIVATE_KEY_CURRENT'] },
  'offers-service': { PORT: '3002', secrets: [] },
});

describe('applySecretScopes', () => {
  describe('Standard use cases', () => {
    it("should move the auth secrets into the auth-service's section", () => {
      const result = applySecretScopes(merged(), makeConfig('fullstack-auth'));

      expect(result['auth-service']).toEqual({
        PORT: '3001',
        secrets: ['JWT_PRIVATE_KEY_CURRENT'],
        JWT_PRIVATE_KEY_CURRENT: 'private-key',
        REFRESH_TOKEN_SECRET: 'refresh',
        ADMIN_EMAILS: 'admin@shop.test',
      });
    });

    it('should leave shared secrets at the top level, and only those', () => {
      const result = applySecretScopes(merged(), makeConfig('fullstack-auth'));

      expect(result.secrets).toEqual({ KONG_TRUST_TOKEN: 'trust' });
      expect(result['offers-service']).toEqual({ PORT: '3002', secrets: [] });
      expect(result.$comment).toBe('generated');
    });
  });

  describe('Edge cases', () => {
    it("should keep a value already in the service's section", () => {
      const file = merged();
      file['auth-service'] = {
        PORT: '3001',
        secrets: [],
        ADMIN_EMAILS: 'own@shop.test',
      };

      const result = applySecretScopes(file, makeConfig('fullstack-auth'));

      expect(
        (result['auth-service'] as Record<string, unknown>).ADMIN_EMAILS,
      ).toBe('own@shop.test');
      expect(result.secrets.ADMIN_EMAILS).toBeUndefined();
    });

    it('should keep a secret top-level when its service has no section', () => {
      const file = merged();
      delete file['auth-service'];

      const result = applySecretScopes(file, makeConfig('fullstack-auth'));

      expect(result.secrets.JWT_PRIVATE_KEY_CURRENT).toBe('private-key');
    });

    it('should change nothing without the auth template', () => {
      const result = applySecretScopes(merged(), makeConfig(null));

      expect(result).toEqual(merged());
    });

    it('should not modify the input', () => {
      const file = merged();

      applySecretScopes(file, makeConfig('fullstack-auth'));

      expect(file).toEqual(merged());
    });
  });
});
