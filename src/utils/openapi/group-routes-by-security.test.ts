import { describe, it, expect } from '@rstest/core';
import { groupRoutesBySecurity } from './group-routes-by-security';
import type { RouteSecurityInfo } from './types';

describe('groupRoutesBySecurity', () => {
  describe('Standard use cases', () => {
    it('should group routes by security type', () => {
      const routes: RouteSecurityInfo[] = [
        { path: '/health', method: 'GET', securityType: 'public' },
        { path: '/users', method: 'GET', securityType: 'jwt' },
        { path: '/api/plans', method: 'GET', securityType: 'partner' },
      ];

      const grouped = groupRoutesBySecurity(routes);

      expect(grouped.public).toHaveLength(1);
      expect(grouped.jwt).toHaveLength(1);
      expect(grouped.partner).toHaveLength(1);
      expect(grouped.public[0].path).toBe('/health');
      expect(grouped.jwt[0].path).toBe('/users');
      expect(grouped.partner[0].path).toBe('/api/plans');
    });

    it('should handle multiple routes per group', () => {
      const routes: RouteSecurityInfo[] = [
        { path: '/health', method: 'GET', securityType: 'public' },
        { path: '/status', method: 'GET', securityType: 'public' },
        { path: '/users', method: 'GET', securityType: 'jwt' },
        { path: '/users', method: 'POST', securityType: 'jwt' },
      ];

      const grouped = groupRoutesBySecurity(routes);

      expect(grouped.public).toHaveLength(2);
      expect(grouped.jwt).toHaveLength(2);
      expect(grouped.partner).toHaveLength(0);
    });
  });

  describe('Edge cases', () => {
    it('should return empty arrays for no routes', () => {
      const grouped = groupRoutesBySecurity([]);

      expect(grouped.public).toEqual([]);
      expect(grouped.jwt).toEqual([]);
      expect(grouped.partner).toEqual([]);
    });
  });
});
