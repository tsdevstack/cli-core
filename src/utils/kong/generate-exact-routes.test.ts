import { describe, it, expect } from '@rstest/core';
import { generateExactRoutes } from './generate-exact-routes';
import type { RouteSecurityInfo } from '../openapi';

function op(path: string, method: string): RouteSecurityInfo {
  return { path, method, securityType: 'jwt' };
}

describe('generateExactRoutes', () => {
  describe('Standard use cases', () => {
    it('should generate one exact route per path with its methods plus OPTIONS', () => {
      const routes = generateExactRoutes({
        routes: [
          op('/offers/v1/plans', 'GET'),
          op('/offers/v1/user/assign-plan', 'POST'),
        ],
        namePrefix: 'offers-service-jwt',
      });

      expect(routes).toEqual([
        {
          name: 'offers-service-jwt-offers-v1-plans',
          paths: ['~/offers/v1/plans$'],
          methods: ['GET', 'OPTIONS'],
          regex_priority: 3,
          strip_path: false,
        },
        {
          name: 'offers-service-jwt-offers-v1-user-assign-plan',
          paths: ['~/offers/v1/user/assign-plan$'],
          methods: ['POST', 'OPTIONS'],
          regex_priority: 4,
          strip_path: false,
        },
      ]);
    });

    it('should group every method of a path into one route', () => {
      const routes = generateExactRoutes({
        routes: [
          op('/offers/v1/plans/{id}', 'PATCH'),
          op('/offers/v1/plans/{id}', 'GET'),
          op('/offers/v1/plans/{id}', 'DELETE'),
        ],
        namePrefix: 'x',
      });

      expect(routes).toHaveLength(1);
      expect(routes[0].methods).toEqual(['DELETE', 'GET', 'PATCH', 'OPTIONS']);
      expect(routes[0].paths).toEqual(['~/offers/v1/plans/[^/]+$']);
    });

    it('should put the path prefix in front and count its segment in the priority', () => {
      const routes = generateExactRoutes({
        routes: [op('/offers/v1/plans/{id}', 'GET')],
        namePrefix: 'offers-service-partner',
        pathPrefix: '/api',
      });

      expect(routes[0]).toEqual({
        name: 'offers-service-partner-offers-v1-plans-id',
        paths: ['~/api/offers/v1/plans/[^/]+$'],
        methods: ['GET', 'OPTIONS'],
        regex_priority: 4,
        strip_path: false,
      });
    });

    it('should give a literal route a higher regex_priority than an overlapping parameter route', () => {
      const routes = generateExactRoutes({
        routes: [
          op('/offers/v1/plans/{id}', 'GET'),
          op('/offers/v1/plans/featured', 'GET'),
        ],
        namePrefix: 'x',
      });
      const byPath = Object.fromEntries(
        routes.map((r) => [r.paths![0], r.regex_priority]),
      );

      expect(byPath['~/offers/v1/plans/featured$']).toBe(4);
      expect(byPath['~/offers/v1/plans/[^/]+$']).toBe(3);
    });
  });

  describe('Edge cases', () => {
    it('should not list OPTIONS twice when the OpenAPI document declares it', () => {
      const routes = generateExactRoutes({
        routes: [op('/a', 'OPTIONS'), op('/a', 'GET')],
        namePrefix: 'x',
      });

      expect(routes[0].methods).toEqual(['GET', 'OPTIONS']);
    });

    it('should deduplicate methods and upper-case them', () => {
      const routes = generateExactRoutes({
        routes: [op('/a', 'get'), op('/a', 'GET')],
        namePrefix: 'x',
      });

      expect(routes[0].methods).toEqual(['GET', 'OPTIONS']);
    });

    it('should sort routes by path so output is stable', () => {
      const a = generateExactRoutes({
        routes: [op('/b', 'GET'), op('/a', 'GET')],
        namePrefix: 'x',
      });
      const b = generateExactRoutes({
        routes: [op('/a', 'GET'), op('/b', 'GET')],
        namePrefix: 'x',
      });

      expect(a).toEqual(b);
      expect(a.map((r) => r.name)).toEqual(['x-a', 'x-b']);
    });

    it('should make names unique when two paths share a slug', () => {
      const routes = generateExactRoutes({
        routes: [
          op('/offers/v2.1/plans', 'GET'),
          op('/offers/v2/1/plans', 'GET'),
          op('/offers/v1/plans', 'GET'),
        ],
        namePrefix: 'x',
      });
      const names = routes.map((r) => r.name);

      expect(new Set(names).size).toBe(3);
      expect(names).toContain('x-offers-v1-plans');
      for (const name of names.filter((n) => n !== 'x-offers-v1-plans')) {
        expect(name).toMatch(/^x-offers-v2-1-plans-[0-9a-f]{8}$/);
      }
    });

    it('should keep a colliding name stable regardless of input order', () => {
      const first = generateExactRoutes({
        routes: [op('/v2.1', 'GET'), op('/v2/1', 'GET')],
        namePrefix: 'x',
      });
      const second = generateExactRoutes({
        routes: [op('/v2/1', 'GET'), op('/v2.1', 'GET')],
        namePrefix: 'x',
      });

      expect(first).toEqual(second);
    });

    it('should return no routes for no operations', () => {
      expect(generateExactRoutes({ routes: [], namePrefix: 'x' })).toEqual([]);
    });
  });
});
