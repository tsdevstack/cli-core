import { describe, it, expect } from '@rstest/core';
import { buildKeyVaultName } from './build-key-vault-name';

const VALID_VAULT_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

describe('buildKeyVaultName', () => {
  describe('Standard use cases', () => {
    it('should name the shared vault {project}-{env}-kv', () => {
      expect(buildKeyVaultName('shop', 'dev')).toBe('shop-dev-kv');
      expect(buildKeyVaultName('shop', 'dev', 'shared')).toBe('shop-dev-kv');
    });

    it("should name a service's vault {project}-{env}-{service}", () => {
      expect(buildKeyVaultName('shop', 'dev', 'bff-service')).toBe(
        'shop-dev-bff-service',
      );
    });

    it('should keep a name of exactly 24 characters', () => {
      expect(buildKeyVaultName('abcdefghijklm', 'dev', 'api-sv')).toBe(
        'abcdefghijklm-dev-api-sv',
      );
    });
  });

  describe('Long names', () => {
    it('should shorten a long name to 24 characters with a hash', () => {
      const name = buildKeyVaultName('shop', 'staging', 'auth-service');

      expect(name).toHaveLength(24);
      expect(name).toMatch(/^shop-staging-au-[0-9a-f]{8}$/);
      expect(name).toMatch(VALID_VAULT_NAME);
    });

    it('should give the same name every time', () => {
      expect(buildKeyVaultName('shop', 'staging', 'auth-service')).toBe(
        buildKeyVaultName('shop', 'staging', 'auth-service'),
      );
    });

    it('should give different names to scopes that share a long prefix', () => {
      const a = buildKeyVaultName(
        'marketplace',
        'production',
        'orders-service',
      );
      const b = buildKeyVaultName('marketplace', 'production', 'orders-worker');

      expect(a).not.toBe(b);
      expect(a.slice(0, 15)).toBe(b.slice(0, 15));
    });

    it('should not leave a hyphen before the hash', () => {
      // The 15-character cut is "abcdefghijklmn-"
      const name = buildKeyVaultName('abcdefghijklmn', 'staging');

      expect(name).toMatch(/^abcdefghijklmn-[0-9a-f]{8}$/);
      expect(name).toMatch(VALID_VAULT_NAME);
    });

    it('should fix the shared vault of a long project name', () => {
      const name = buildKeyVaultName('my-saas-platform', 'staging');

      expect(name).toHaveLength(24);
      expect(name).toMatch(VALID_VAULT_NAME);
    });
  });

  describe('Edge cases', () => {
    it('should collapse repeated hyphens, which Key Vault rejects', () => {
      expect(buildKeyVaultName('my--app', 'dev')).toBe('my-app-dev-kv');
    });

    it('should drop characters Key Vault does not allow', () => {
      expect(buildKeyVaultName('shop', 'Dev_1')).toBe('shop-dev1-kv');
    });
  });
});
