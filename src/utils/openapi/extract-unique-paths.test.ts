import { describe, it, expect } from '@rstest/core';
import { extractUniquePaths } from './extract-unique-paths';
import type { RouteSecurityInfo } from './types';

describe('extractUniquePaths', () => {
  describe('Standard use cases', () => {
    it('should return unique sorted paths', () => {
      const routes: RouteSecurityInfo[] = [
        { path: '/users', method: 'GET', securityType: 'jwt' },
        { path: '/users', method: 'POST', securityType: 'jwt' },
        { path: '/health', method: 'GET', securityType: 'public' },
      ];

      const paths = extractUniquePaths(routes);

      expect(paths).toEqual(['/health', '/users']);
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for no routes', () => {
      expect(extractUniquePaths([])).toEqual([]);
    });
  });
});
