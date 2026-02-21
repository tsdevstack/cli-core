import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('./load-openapi-document', () => ({
  loadOpenApiDocument: rs.fn(),
}));
rs.mock('./extract-route-security', () => ({
  extractRouteSecurityInfo: rs.fn(),
}));
rs.mock('./group-routes-by-security', () => ({
  groupRoutesBySecurity: rs.fn(),
}));
rs.mock('../logger', () => ({
  logger: {
    debug: rs.fn(),
    info: rs.fn(),
  },
}));

import { parseOpenApiSecurity } from './parse-openapi-security';
import { loadOpenApiDocument } from './load-openapi-document';
import { extractRouteSecurityInfo } from './extract-route-security';
import { groupRoutesBySecurity } from './group-routes-by-security';
import { logger } from '../logger';

describe('parseOpenApiSecurity', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should parse OpenAPI document and return grouped routes', () => {
      const mockDoc = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      };
      const mockRoutes = [
        { path: '/health', method: 'GET', securityType: 'public' as const },
        { path: '/users', method: 'GET', securityType: 'jwt' as const },
      ];
      const mockGrouped = {
        public: [mockRoutes[0]],
        jwt: [mockRoutes[1]],
        partner: [],
      };

      rs.mocked(loadOpenApiDocument).mockReturnValue(mockDoc);
      rs.mocked(extractRouteSecurityInfo).mockReturnValue(mockRoutes);
      rs.mocked(groupRoutesBySecurity).mockReturnValue(mockGrouped);

      const result = parseOpenApiSecurity('auth-service', '/path/openapi.json');

      expect(result).toEqual({
        serviceName: 'auth-service',
        openApiPath: '/path/openapi.json',
        groupedRoutes: mockGrouped,
      });
    });

    it('should call functions in correct order with correct args', () => {
      const mockDoc = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      };
      const mockRoutes = [
        { path: '/health', method: 'GET', securityType: 'public' as const },
      ];
      const mockGrouped = { public: mockRoutes, jwt: [], partner: [] };

      rs.mocked(loadOpenApiDocument).mockReturnValue(mockDoc);
      rs.mocked(extractRouteSecurityInfo).mockReturnValue(mockRoutes);
      rs.mocked(groupRoutesBySecurity).mockReturnValue(mockGrouped);

      parseOpenApiSecurity('offers-service', '/openapi.json');

      expect(loadOpenApiDocument).toHaveBeenCalledWith('/openapi.json');
      expect(extractRouteSecurityInfo).toHaveBeenCalledWith(mockDoc);
      expect(groupRoutesBySecurity).toHaveBeenCalledWith(mockRoutes);
    });

    it('should log debug and info messages', () => {
      const mockGrouped = { public: [], jwt: [], partner: [] };

      rs.mocked(loadOpenApiDocument).mockReturnValue({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      });
      rs.mocked(extractRouteSecurityInfo).mockReturnValue([]);
      rs.mocked(groupRoutesBySecurity).mockReturnValue(mockGrouped);

      parseOpenApiSecurity('my-service', '/path/openapi.json');

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('my-service'),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('my-service'),
      );
    });

    it('should include route counts in info log', () => {
      const mockGrouped = {
        public: [
          { path: '/health', method: 'GET', securityType: 'public' as const },
        ],
        jwt: [
          { path: '/users', method: 'GET', securityType: 'jwt' as const },
          { path: '/users', method: 'POST', securityType: 'jwt' as const },
        ],
        partner: [],
      };

      rs.mocked(loadOpenApiDocument).mockReturnValue({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      });
      rs.mocked(extractRouteSecurityInfo).mockReturnValue([]);
      rs.mocked(groupRoutesBySecurity).mockReturnValue(mockGrouped);

      parseOpenApiSecurity('svc', '/openapi.json');

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('1 public'),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('2 JWT'),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('0 partner'),
      );
    });
  });
});
