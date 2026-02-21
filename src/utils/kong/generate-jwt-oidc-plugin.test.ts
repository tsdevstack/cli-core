import { describe, it, expect } from '@rstest/core';
import { generateJwtOidcPlugin } from './generate-jwt-oidc-plugin';
import type { JwtOidcPluginConfig } from './plugin-types';

describe('generateJwtOidcPlugin', () => {
  describe('Auth template mode (authServiceUrl + authServicePrefix)', () => {
    it('should generate JWT OIDC plugin with correct structure', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('config');
      expect(result.name).toBe('oidc');
    });

    it('should generate discovery endpoint from authServiceUrl and authServicePrefix', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });

      expect(result.config.discovery).toBe(
        'http://localhost:3001/auth/.well-known/openid-configuration',
      );
    });

    it('should set bearer-only mode', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });

      expect(result.config.bearer_only).toBe('yes');
      expect(result.config.bearer_jwt_auth_enable).toBe('yes');
    });

    it('should set default client credentials', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });

      expect(result.config.client_id).toBe('kong');
      expect(result.config.client_secret).toBe('kong-secret');
    });

    it('should use KONG_SSL_VERIFY placeholder for SSL verification', () => {
      const httpResult = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });
      const httpsResult = generateJwtOidcPlugin({
        authServiceUrl: 'https://auth.example.com',
        authServicePrefix: 'auth',
      });

      // Always uses placeholder - resolved from secrets at config generation time
      expect(httpResult.config.ssl_verify).toBe('${KONG_SSL_VERIFY}');
      expect(httpsResult.config.ssl_verify).toBe('${KONG_SSL_VERIFY}');
    });

    it('should set userinfo header name', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });

      expect(result.config.userinfo_header_name).toBe('X-Userinfo');
    });
  });

  describe('External OIDC mode (discoveryUrl)', () => {
    it('should use discoveryUrl directly when provided', () => {
      const result = generateJwtOidcPlugin({
        discoveryUrl:
          'https://your-domain.auth0.com/.well-known/openid-configuration',
      });

      expect(result.config.discovery).toBe(
        'https://your-domain.auth0.com/.well-known/openid-configuration',
      );
    });

    it('should prefer discoveryUrl over authServiceUrl/authServicePrefix', () => {
      const result = generateJwtOidcPlugin({
        discoveryUrl:
          'https://external.oidc.provider/.well-known/openid-configuration',
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });

      expect(result.config.discovery).toBe(
        'https://external.oidc.provider/.well-known/openid-configuration',
      );
    });

    it('should generate valid plugin config with external OIDC', () => {
      const result = generateJwtOidcPlugin({
        discoveryUrl:
          'https://cognito.aws.amazon.com/.well-known/openid-configuration',
      });

      expect(result.name).toBe('oidc');
      expect(result.config.bearer_only).toBe('yes');
      expect(result.config.client_id).toBe('kong');
    });
  });

  describe('Different authServiceUrl formats', () => {
    it('should handle localhost URL', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });

      expect(result.config.discovery).toBe(
        'http://localhost:3001/auth/.well-known/openid-configuration',
      );
    });

    it('should handle production URL', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'https://api.example.com',
        authServicePrefix: 'auth',
      });

      expect(result.config.discovery).toBe(
        'https://api.example.com/auth/.well-known/openid-configuration',
      );
    });

    it('should handle URL with port', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://auth-service:8080',
        authServicePrefix: 'auth',
      });

      expect(result.config.discovery).toBe(
        'http://auth-service:8080/auth/.well-known/openid-configuration',
      );
    });

    it('should handle internal Docker service name', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://auth-service',
        authServicePrefix: 'auth',
      });

      expect(result.config.discovery).toBe(
        'http://auth-service/auth/.well-known/openid-configuration',
      );
    });
  });

  describe('Different authServicePrefix values', () => {
    it('should handle standard auth prefix', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });

      expect(result.config.discovery).toBe(
        'http://localhost:3001/auth/.well-known/openid-configuration',
      );
    });

    it('should handle custom prefix', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'authentication',
      });

      expect(result.config.discovery).toBe(
        'http://localhost:3001/authentication/.well-known/openid-configuration',
      );
    });

    it('should handle versioned prefix', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth/v1',
      });

      expect(result.config.discovery).toBe(
        'http://localhost:3001/auth/v1/.well-known/openid-configuration',
      );
    });
  });

  describe('Plugin configuration values', () => {
    it('should have correct name property', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });

      expect(result.name).toBe('oidc');
    });

    it('should have all required config properties', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });

      expect(result.config).toHaveProperty('client_id');
      expect(result.config).toHaveProperty('client_secret');
      expect(result.config).toHaveProperty('discovery');
      expect(result.config).toHaveProperty('bearer_only');
      expect(result.config).toHaveProperty('bearer_jwt_auth_enable');
      expect(result.config).toHaveProperty('ssl_verify');
      expect(result.config).toHaveProperty('userinfo_header_name');
    });

    it('should use consistent client credentials', () => {
      const result1 = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });
      const result2 = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3002',
        authServicePrefix: 'auth',
      });

      expect(result1.config.client_id).toBe(result2.config.client_id);
      expect(result1.config.client_secret).toBe(result2.config.client_secret);
    });
  });

  describe('Return value structure', () => {
    it('should match JwtOidcPluginConfig type structure', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });

      // TypeScript will ensure this at compile time, but we verify at runtime too
      const plugin: JwtOidcPluginConfig = result;
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('oidc');
    });

    it('should return new object on each call', () => {
      const result1 = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });
      const result2 = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });

    it('should return object with only expected properties', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });

      const expectedKeys = ['name', 'config'];
      expect(Object.keys(result)).toEqual(expectedKeys);
    });

    it('should return config with only expected properties', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });

      const expectedConfigKeys = [
        'client_id',
        'client_secret',
        'discovery',
        'bearer_only',
        'bearer_jwt_auth_enable',
        'ssl_verify',
        'unauth_action',
        'userinfo_header_name',
      ];
      expect(Object.keys(result.config).sort()).toEqual(
        expectedConfigKeys.sort(),
      );
    });
  });

  describe('Real-world scenarios', () => {
    it('should generate plugin for local development with auth template', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth',
      });

      expect(result).toEqual({
        name: 'oidc',
        config: {
          client_id: 'kong',
          client_secret: 'kong-secret',
          discovery:
            'http://localhost:3001/auth/.well-known/openid-configuration',
          bearer_only: 'yes',
          bearer_jwt_auth_enable: 'yes',
          ssl_verify: '${KONG_SSL_VERIFY}',
          unauth_action: 'deny',
          userinfo_header_name: 'X-Userinfo',
        },
      });
    });

    it('should generate plugin for Docker Compose environment', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://auth-service:3001',
        authServicePrefix: 'auth',
      });

      expect(result).toEqual({
        name: 'oidc',
        config: {
          client_id: 'kong',
          client_secret: 'kong-secret',
          discovery:
            'http://auth-service:3001/auth/.well-known/openid-configuration',
          bearer_only: 'yes',
          bearer_jwt_auth_enable: 'yes',
          ssl_verify: '${KONG_SSL_VERIFY}',
          unauth_action: 'deny',
          userinfo_header_name: 'X-Userinfo',
        },
      });
    });

    it('should generate plugin for external OIDC provider (Auth0)', () => {
      const result = generateJwtOidcPlugin({
        discoveryUrl:
          'https://your-tenant.auth0.com/.well-known/openid-configuration',
      });

      expect(result).toEqual({
        name: 'oidc',
        config: {
          client_id: 'kong',
          client_secret: 'kong-secret',
          discovery:
            'https://your-tenant.auth0.com/.well-known/openid-configuration',
          bearer_only: 'yes',
          bearer_jwt_auth_enable: 'yes',
          ssl_verify: '${KONG_SSL_VERIFY}',
          unauth_action: 'deny',
          userinfo_header_name: 'X-Userinfo',
        },
      });
    });

    it('should generate plugin with OIDC_DISCOVERY_URL placeholder', () => {
      const result = generateJwtOidcPlugin({
        discoveryUrl: '${OIDC_DISCOVERY_URL}',
      });

      expect(result.config.discovery).toBe('${OIDC_DISCOVERY_URL}');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long URLs', () => {
      const longUrl =
        'http://very-long-auth-service-name-with-many-characters.example.com:8080';
      const result = generateJwtOidcPlugin({
        authServiceUrl: longUrl,
        authServicePrefix: 'auth',
      });

      expect(result.config.discovery).toBe(
        `${longUrl}/auth/.well-known/openid-configuration`,
      );
    });

    it('should handle very long prefixes', () => {
      const longPrefix = 'very/long/nested/prefix/structure/auth';
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: longPrefix,
      });

      expect(result.config.discovery).toBe(
        `http://localhost:3001/${longPrefix}/.well-known/openid-configuration`,
      );
    });

    it('should handle special characters in prefix', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://localhost:3001',
        authServicePrefix: 'auth-v2.1',
      });

      expect(result.config.discovery).toBe(
        'http://localhost:3001/auth-v2.1/.well-known/openid-configuration',
      );
    });

    it('should handle IPv4 addresses', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://192.168.1.100:3001',
        authServicePrefix: 'auth',
      });

      expect(result.config.discovery).toBe(
        'http://192.168.1.100:3001/auth/.well-known/openid-configuration',
      );
    });

    it('should handle IPv6 addresses', () => {
      const result = generateJwtOidcPlugin({
        authServiceUrl: 'http://[::1]:3001',
        authServicePrefix: 'auth',
      });

      expect(result.config.discovery).toBe(
        'http://[::1]:3001/auth/.well-known/openid-configuration',
      );
    });
  });
});
