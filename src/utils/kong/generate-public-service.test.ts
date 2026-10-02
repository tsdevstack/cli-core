import { describe, it, expect } from '@rstest/core';
import { generatePublicService } from './generate-public-service';
import type { ServiceRouteConfig } from './types';

const config: ServiceRouteConfig = {
  serviceName: 'auth-service',
  serviceUrl: '${KONG_SERVICE_HOST}:3001',
  globalPrefix: 'auth',
  partnerApi: { defaultLimits: {}, ipLimitPerMinute: 600 },
  groupedRoutes: {
    public: [
      { path: '/auth/v1/auth/login', method: 'POST', securityType: 'public' },
      {
        path: '/auth/.well-known/jwks.json',
        method: 'GET',
        securityType: 'public',
      },
    ],
    jwt: [],
    partner: [],
  },
};

describe('generatePublicService', () => {
  describe('Standard use cases', () => {
    it('should generate the public service with exact routes and no plugins', () => {
      const service = generatePublicService(config);

      expect(service.name).toBe('auth-service-public');
      expect(service.url).toBe('${KONG_SERVICE_HOST}:3001');
      expect(service.plugins).toBeUndefined();
      expect(service.routes).toEqual([
        {
          name: 'auth-service-public-auth-well-known-jwks-json',
          paths: ['~/auth/\\.well-known/jwks\\.json$'],
          methods: ['GET', 'OPTIONS'],
          regex_priority: 3,
          strip_path: false,
        },
        {
          name: 'auth-service-public-auth-v1-auth-login',
          paths: ['~/auth/v1/auth/login$'],
          methods: ['POST', 'OPTIONS'],
          regex_priority: 4,
          strip_path: false,
        },
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should keep the service URL without a path (no rewrite)', () => {
      expect(generatePublicService(config).url).not.toContain('/auth');
    });
  });
});
