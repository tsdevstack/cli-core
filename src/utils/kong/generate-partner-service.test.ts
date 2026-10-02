import { describe, it, expect } from '@rstest/core';
import { generatePartnerService } from './generate-partner-service';
import type { ServiceRouteConfig } from './types';

const config: ServiceRouteConfig = {
  serviceName: 'offers-service',
  serviceUrl: '${KONG_SERVICE_HOST}:3002',
  globalPrefix: 'offers',
  partnerApi: { defaultLimits: { minute: 100 }, ipLimitPerMinute: 600 },
  groupedRoutes: {
    public: [],
    jwt: [],
    partner: [
      { path: '/offers/v1/plans', method: 'GET', securityType: 'partner' },
      {
        path: '/offers/v1/plans/{id}',
        method: 'GET',
        securityType: 'partner',
      },
    ],
  },
};

describe('generatePartnerService', () => {
  describe('Standard use cases', () => {
    it('should generate one exact /api route per @PartnerApi() path', () => {
      const service = generatePartnerService(config);

      expect(service.name).toBe('offers-service-partner');
      expect(service.routes).toEqual([
        {
          name: 'offers-service-partner-offers-v1-plans',
          paths: ['~/api/offers/v1/plans$'],
          methods: ['GET', 'OPTIONS'],
          regex_priority: 4,
          strip_path: false,
        },
        {
          name: 'offers-service-partner-offers-v1-plans-id',
          paths: ['~/api/offers/v1/plans/[^/]+$'],
          methods: ['GET', 'OPTIONS'],
          regex_priority: 4,
          strip_path: false,
        },
      ]);
    });

    it('should use the service URL without a path (the prefix plugin rewrites it)', () => {
      expect(generatePartnerService(config).url).toBe(
        '${KONG_SERVICE_HOST}:3002',
      );
    });

    it('should attach the per-IP ceiling, tsdevstack-api-key and tsdevstack-api-prefix', () => {
      const redis = {
        host: '${REDIS_HOST}',
        port: '${REDIS_PORT}',
        password: '${REDIS_PASSWORD}',
        database: 0,
        timeout: 2000,
      };
      expect(generatePartnerService(config).plugins).toEqual([
        {
          name: 'rate-limiting',
          config: {
            minute: 600,
            limit_by: 'ip',
            policy: 'redis',
            hide_client_headers: false,
            redis,
          },
        },
        {
          name: 'tsdevstack-api-key',
          config: {
            key_names: ['x-api-key'],
            redis,
            default_limits: { minute: 100 },
          },
        },
        { name: 'tsdevstack-api-prefix', config: { prefix: '/api' } },
      ]);
    });

    it('should use the configured ceiling and default limits', () => {
      const plugins = generatePartnerService({
        ...config,
        partnerApi: { defaultLimits: { hour: 50 }, ipLimitPerMinute: 30 },
      }).plugins!;
      expect(plugins[0].config.minute).toBe(30);
      expect(plugins[1].config.default_limits).toEqual({ hour: 50 });
    });

    it('should not generate key-auth', () => {
      expect(JSON.stringify(generatePartnerService(config))).not.toContain(
        'key-auth',
      );
    });
  });

  describe('Edge cases', () => {
    it('should not route any path outside the @PartnerApi() operations (no catch-all)', () => {
      const paths = generatePartnerService(config).routes.flatMap(
        (r) => r.paths ?? [],
      );

      expect(paths).not.toContain('/api/offers');
      expect(
        paths.every((p) => p.startsWith('~/api/') && p.endsWith('$')),
      ).toBe(true);
    });
  });
});
