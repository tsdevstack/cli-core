import { describe, it, expect } from '@rstest/core';
import { generateJwtService } from './generate-jwt-service';
import type { ServiceRouteConfig } from './types';

function makeConfig(
  overrides: Partial<ServiceRouteConfig> = {},
): ServiceRouteConfig {
  return {
    serviceName: 'offers-service',
    serviceUrl: '${KONG_SERVICE_HOST}:3002',
    globalPrefix: 'offers',
    partnerApi: { defaultLimits: {}, ipLimitPerMinute: 600 },
    groupedRoutes: {
      public: [],
      jwt: [
        {
          path: '/offers/v1/user/assign-plan',
          method: 'POST',
          securityType: 'jwt',
        },
        { path: '/offers/v1/plans/{id}', method: 'GET', securityType: 'jwt' },
      ],
      partner: [],
    },
    authServiceUrl: '${KONG_SERVICE_HOST}:3001',
    authServicePrefix: 'auth',
    ...overrides,
  };
}

describe('generateJwtService', () => {
  describe('Standard use cases', () => {
    it('should generate exact routes and the oidc plugin', () => {
      const service = generateJwtService(makeConfig());

      expect(service.name).toBe('offers-service-jwt');
      expect(service.url).toBe('${KONG_SERVICE_HOST}:3002');
      expect(service.routes.map((r) => [r.paths, r.methods])).toEqual([
        [['~/offers/v1/plans/[^/]+$'], ['GET', 'OPTIONS']],
        [['~/offers/v1/user/assign-plan$'], ['POST', 'OPTIONS']],
      ]);
      expect(service.routes.every((r) => r.strip_path === false)).toBe(true);
      expect(service.plugins).toHaveLength(1);
      expect(service.plugins![0].name).toBe('oidc');
      expect(service.plugins![0].config.discovery).toBe(
        '${KONG_SERVICE_HOST}:3001/auth/.well-known/openid-configuration',
      );
    });
  });

  describe('Edge cases', () => {
    it('should prefer the direct OIDC discovery URL', () => {
      const service = generateJwtService(
        makeConfig({ oidcDiscoveryUrl: '${OIDC_DISCOVERY_URL}' }),
      );

      expect(service.plugins![0].config.discovery).toBe(
        '${OIDC_DISCOVERY_URL}',
      );
    });
  });
});
