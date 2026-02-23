import { describe, it, expect } from '@rstest/core';
import { groupRoutesByPath } from './group-routes-by-path';
import type { RouteSecurityInfo } from './types';

describe('groupRoutesByPath', () => {
  describe('Standard use cases', () => {
    it('should group methods by path', () => {
      const routes: RouteSecurityInfo[] = [
        { path: '/users', method: 'GET', securityType: 'jwt' },
        { path: '/users', method: 'POST', securityType: 'jwt' },
        { path: '/health', method: 'GET', securityType: 'public' },
      ];

      const pathMap = groupRoutesByPath(routes);

      expect(pathMap.get('/users')).toEqual(['GET', 'POST']);
      expect(pathMap.get('/health')).toEqual(['GET']);
    });
  });

  describe('Edge cases', () => {
    it('should return empty map for no routes', () => {
      const pathMap = groupRoutesByPath([]);

      expect(pathMap.size).toBe(0);
    });
  });
});
