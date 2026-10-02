import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('../logger', () => ({
  logger: { warn: rs.fn(), info: rs.fn() },
}));

import { generateSecurityBasedServices } from './generate-security-routes';
import { buildFrameworkKongConfig } from './build-framework-kong-config';
import { getDefaultKongPlugins } from './default-plugins';
import { mergeKongConfigs } from './merge-kong-configs';
import { logger } from '../logger';
import type { ServiceRouteConfig } from './types';
import type { RouteSecurityInfo, SecurityType } from '../openapi';

function op(
  path: string,
  method: string,
  securityType: SecurityType,
): RouteSecurityInfo {
  return { path, method, securityType };
}

/** Routes of the reference offers-service (dual-access /plans and /plans/{id}) */
function offersConfig(): ServiceRouteConfig {
  return {
    serviceName: 'offers-service',
    serviceUrl: '${KONG_SERVICE_HOST}:3002',
    globalPrefix: 'offers',
    partnerApi: { defaultLimits: {}, ipLimitPerMinute: 600 },
    groupedRoutes: {
      public: [op('/offers/v1/health', 'GET', 'public')],
      jwt: [
        op('/offers/v1/plans', 'GET', 'jwt'),
        op('/offers/v1/plans/{id}', 'GET', 'jwt'),
        op('/offers/v1/user/assign-plan', 'POST', 'jwt'),
        op('/offers/v2.1/user/active-plan', 'GET', 'jwt'),
      ],
      partner: [
        op('/offers/v1/plans', 'GET', 'partner'),
        op('/offers/v1/plans/{id}', 'GET', 'partner'),
      ],
    },
    authServiceUrl: '${KONG_SERVICE_HOST}:3001',
    authServicePrefix: 'auth',
  };
}

describe('generateSecurityBasedServices', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should generate public, JWT and partner services in that order', () => {
      const services = generateSecurityBasedServices(offersConfig());

      expect(services.map((s) => s.name)).toEqual([
        'offers-service-public',
        'offers-service-jwt',
        'offers-service-partner',
      ]);
    });

    it('should only publish @PartnerApi() paths under /api', () => {
      const partner = generateSecurityBasedServices(offersConfig())[2];

      expect(partner.routes.flatMap((r) => r.paths)).toEqual([
        '~/api/offers/v1/plans$',
        '~/api/offers/v1/plans/[^/]+$',
      ]);
    });

    it('should make every route exact: anchored regex, methods with OPTIONS, no path stripping', () => {
      const routes = generateSecurityBasedServices(offersConfig()).flatMap(
        (s) => s.routes,
      );

      for (const route of routes) {
        expect(route.paths).toHaveLength(1);
        expect(route.paths![0]).toMatch(/^~\/.*\$$/);
        expect(route.methods).toContain('OPTIONS');
        expect(route.methods!.length).toBeGreaterThan(1);
        expect(route.strip_path).toBe(false);
        expect(typeof route.regex_priority).toBe('number');
      }
    });

    it('should put the key plugin and the per-IP ceiling on the partner service only', () => {
      const services = generateSecurityBasedServices(offersConfig());
      const names = (index: number): string[] =>
        (services[index].plugins ?? []).map((plugin) => plugin.name);

      expect(names(2)).toEqual([
        'rate-limiting',
        'tsdevstack-api-key',
        'tsdevstack-api-prefix',
      ]);
      expect(names(0)).not.toContain('tsdevstack-api-key');
      expect(names(1)).not.toContain('tsdevstack-api-key');
      expect(JSON.stringify(services)).not.toContain('key-auth');
    });

    it('should give every route a unique name', () => {
      const names = generateSecurityBasedServices(offersConfig()).flatMap((s) =>
        s.routes.map((r) => r.name),
      );

      expect(new Set(names).size).toBe(names.length);
    });

    it('should not warn when every path is under the global prefix', () => {
      generateSecurityBasedServices(offersConfig());

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Generated config has no route-level request-transformer or pre-function', () => {
    it('should keep them out of services, routes and the merged config', () => {
      const framework = buildFrameworkKongConfig(
        generateSecurityBasedServices(offersConfig()),
      );
      const merged = mergeKongConfigs(framework, {
        services: [],
        plugins: getDefaultKongPlugins(),
      });
      const json = JSON.stringify(merged.services);

      expect(json).not.toContain('request-transformer');
      expect(json).not.toContain('pre-function');
      expect(json).not.toContain('post-function');
      // The only request-transformer is the user's global one
      expect(
        merged.plugins!.filter((p) => p.name === 'request-transformer'),
      ).toHaveLength(1);
      expect(merged.plugins![0].name).toBe('tsdevstack-strip-identity');
    });
  });

  describe('Edge cases', () => {
    it('should generate nothing without routes', () => {
      expect(
        generateSecurityBasedServices({
          ...offersConfig(),
          groupedRoutes: { public: [], jwt: [], partner: [] },
        }),
      ).toEqual([]);
    });

    it('should skip service kinds without routes', () => {
      const services = generateSecurityBasedServices({
        ...offersConfig(),
        groupedRoutes: {
          public: [],
          jwt: [op('/offers/v1/plans', 'GET', 'jwt')],
          partner: [],
        },
      });

      expect(services.map((s) => s.name)).toEqual(['offers-service-jwt']);
    });

    it('should treat a path equal to the global prefix as inside it', () => {
      generateSecurityBasedServices({
        ...offersConfig(),
        groupedRoutes: {
          public: [op('/offers', 'GET', 'public')],
          jwt: [],
          partner: [],
        },
      });

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should not treat a longer first segment as inside the prefix', () => {
      generateSecurityBasedServices({
        ...offersConfig(),
        groupedRoutes: {
          public: [op('/offersX/v1', 'GET', 'public')],
          jwt: [],
          partner: [],
        },
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('/offersX/v1'),
      );
    });

    it('should warn about paths outside the global prefix', () => {
      generateSecurityBasedServices({
        ...offersConfig(),
        groupedRoutes: {
          public: [op('/health', 'GET', 'public')],
          jwt: [op('/offers/v1/plans', 'GET', 'jwt')],
          partner: [op('/v1/plans', 'GET', 'partner')],
        },
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('/health, /v1/plans'),
      );
    });
  });
});
