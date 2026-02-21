import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('../openapi', () => ({
  extractUniquePaths: rs.fn(),
}));
rs.mock('./generate-jwt-oidc-plugin', () => ({
  generateJwtOidcPlugin: rs.fn(),
}));
rs.mock('./generate-key-auth-plugin', () => ({
  generateKeyAuthPlugin: rs.fn(),
}));

import {
  generateSecurityBasedServices,
  type ServiceRouteConfig,
} from './generate-security-routes';
import { extractUniquePaths } from '../openapi';
import { generateJwtOidcPlugin } from './generate-jwt-oidc-plugin';
import { generateKeyAuthPlugin } from './generate-key-auth-plugin';

describe('generateSecurityBasedServices', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    rs.mocked(generateJwtOidcPlugin).mockReturnValue({
      name: 'oidc',
      config: {
        client_id: 'id',
        client_secret: 'secret',
        discovery: 'url',
        bearer_only: 'yes',
        bearer_jwt_auth_enable: 'yes',
        ssl_verify: 'no',
      },
    });
    rs.mocked(generateKeyAuthPlugin).mockReturnValue({
      name: 'key-auth',
      config: { key_names: ['x-api-key'], hide_credentials: false },
    });
  });

  function makeConfig(
    overrides: Partial<ServiceRouteConfig> = {},
  ): ServiceRouteConfig {
    return {
      serviceName: 'offers-service',
      serviceUrl: 'http://offers-service:3003',
      globalPrefix: 'offers',
      groupedRoutes: {
        public: [],
        jwt: [],
        partner: [],
      },
      ...overrides,
    };
  }

  describe('Public service generation', () => {
    it('should generate public service when public routes exist', () => {
      rs.mocked(extractUniquePaths).mockReturnValue(['/health', '/status']);

      const config = makeConfig({
        groupedRoutes: {
          public: [
            { path: '/health', method: 'GET', securityType: 'public' },
            { path: '/status', method: 'GET', securityType: 'public' },
          ],
          jwt: [],
          partner: [],
        },
      });

      const services = generateSecurityBasedServices(config);

      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('offers-service-public');
      expect(services[0].url).toBe('http://offers-service:3003');
      expect(services[0].routes[0].paths).toEqual(['/health', '/status']);
      expect(services[0].routes[0].strip_path).toBe(false);
    });

    it('should not generate public service when no public routes', () => {
      const config = makeConfig();

      const services = generateSecurityBasedServices(config);

      expect(services).toHaveLength(0);
    });
  });

  describe('JWT service generation', () => {
    it('should generate JWT service with OIDC plugin when jwt routes exist', () => {
      rs.mocked(extractUniquePaths).mockReturnValue(['/users']);

      const config = makeConfig({
        groupedRoutes: {
          public: [],
          jwt: [{ path: '/users', method: 'GET', securityType: 'jwt' }],
          partner: [],
        },
        authServiceUrl: 'http://auth:3001',
        authServicePrefix: 'auth',
      });

      const services = generateSecurityBasedServices(config);

      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('offers-service-jwt');
      expect(services[0].plugins).toHaveLength(1);
      expect(services[0].plugins![0].name).toBe('oidc');
      expect(generateJwtOidcPlugin).toHaveBeenCalledWith({
        discoveryUrl: undefined,
        authServiceUrl: 'http://auth:3001',
        authServicePrefix: 'auth',
      });
    });

    it('should pass oidcDiscoveryUrl when provided', () => {
      rs.mocked(extractUniquePaths).mockReturnValue(['/users']);

      const config = makeConfig({
        groupedRoutes: {
          public: [],
          jwt: [{ path: '/users', method: 'GET', securityType: 'jwt' }],
          partner: [],
        },
        oidcDiscoveryUrl:
          'https://auth0.example.com/.well-known/openid-configuration',
      });

      generateSecurityBasedServices(config);

      expect(generateJwtOidcPlugin).toHaveBeenCalledWith({
        discoveryUrl:
          'https://auth0.example.com/.well-known/openid-configuration',
        authServiceUrl: undefined,
        authServicePrefix: undefined,
      });
    });
  });

  describe('Partner service generation', () => {
    it('should generate partner service with key-auth plugin', () => {
      const config = makeConfig({
        groupedRoutes: {
          public: [],
          jwt: [],
          partner: [
            { path: '/api/plans', method: 'GET', securityType: 'partner' },
          ],
        },
      });

      const services = generateSecurityBasedServices(config);

      expect(services).toHaveLength(1);
      expect(services[0].name).toBe('offers-service-partner');
      expect(services[0].url).toBe('http://offers-service:3003/offers');
      expect(services[0].routes[0].paths).toEqual(['/api/offers']);
      expect(services[0].routes[0].strip_path).toBe(true);
      expect(services[0].plugins).toHaveLength(1);
      expect(services[0].plugins![0].name).toBe('key-auth');
    });
  });

  describe('Combined services', () => {
    it('should generate all three services when all route types exist', () => {
      rs.mocked(extractUniquePaths).mockReturnValue(['/path']);

      const config = makeConfig({
        groupedRoutes: {
          public: [{ path: '/health', method: 'GET', securityType: 'public' }],
          jwt: [{ path: '/users', method: 'GET', securityType: 'jwt' }],
          partner: [
            { path: '/api/plans', method: 'GET', securityType: 'partner' },
          ],
        },
      });

      const services = generateSecurityBasedServices(config);

      expect(services).toHaveLength(3);
      expect(services.map((s) => s.name)).toEqual([
        'offers-service-public',
        'offers-service-jwt',
        'offers-service-partner',
      ]);
    });

    it('should return empty array when no routes exist', () => {
      const config = makeConfig();

      const services = generateSecurityBasedServices(config);

      expect(services).toEqual([]);
    });
  });
});
