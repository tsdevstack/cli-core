import { describe, it, expect } from '@rstest/core';
import { extractRouteSecurityInfo } from './extract-route-security';
import type { OpenApiDocument } from './types';

function makeDocument(paths: OpenApiDocument['paths']): OpenApiDocument {
  return {
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths,
  };
}

describe('extractRouteSecurityInfo', () => {
  describe('Public routes', () => {
    it('should mark routes without security as public', () => {
      const doc = makeDocument({
        '/health': {
          get: {},
        },
      });

      const routes = extractRouteSecurityInfo(doc);

      expect(routes).toEqual([
        { path: '/health', method: 'GET', securityType: 'public' },
      ]);
    });

    it('should mark routes with empty security array as public', () => {
      const doc = makeDocument({
        '/health': {
          get: { security: [] },
        },
      });

      const routes = extractRouteSecurityInfo(doc);

      expect(routes).toEqual([
        { path: '/health', method: 'GET', securityType: 'public' },
      ]);
    });
  });

  describe('JWT routes', () => {
    it('should mark routes with bearer security as jwt', () => {
      const doc = makeDocument({
        '/users': {
          get: { security: [{ bearer: [] }] },
        },
      });

      const routes = extractRouteSecurityInfo(doc);

      expect(routes).toEqual([
        { path: '/users', method: 'GET', securityType: 'jwt' },
      ]);
    });
  });

  describe('Partner routes', () => {
    it('should mark routes with api-key security as partner', () => {
      const doc = makeDocument({
        '/api/plans': {
          get: { security: [{ 'api-key': [] }] },
        },
      });

      const routes = extractRouteSecurityInfo(doc);

      expect(routes).toEqual([
        { path: '/api/plans', method: 'GET', securityType: 'partner' },
      ]);
    });
  });

  describe('Dual-access routes', () => {
    it('should create two routes for bearer + api-key (dual-access)', () => {
      const doc = makeDocument({
        '/offers': {
          get: { security: [{ bearer: [] }, { 'api-key': [] }] },
        },
      });

      const routes = extractRouteSecurityInfo(doc);

      expect(routes).toHaveLength(2);
      expect(routes).toContainEqual({
        path: '/offers',
        method: 'GET',
        securityType: 'jwt',
      });
      expect(routes).toContainEqual({
        path: '/offers',
        method: 'GET',
        securityType: 'partner',
      });
    });
  });

  describe('Multiple methods', () => {
    it('should extract routes for all HTTP methods', () => {
      const doc = makeDocument({
        '/users': {
          get: { security: [{ bearer: [] }] },
          post: { security: [{ bearer: [] }] },
          delete: { security: [{ bearer: [] }] },
        },
      });

      const routes = extractRouteSecurityInfo(doc);

      expect(routes).toHaveLength(3);
      expect(routes.map((r) => r.method)).toContain('GET');
      expect(routes.map((r) => r.method)).toContain('POST');
      expect(routes.map((r) => r.method)).toContain('DELETE');
    });

    it('should skip undefined methods', () => {
      const doc = makeDocument({
        '/users': {
          get: { security: [{ bearer: [] }] },
        },
      });

      const routes = extractRouteSecurityInfo(doc);

      expect(routes).toHaveLength(1);
      expect(routes[0].method).toBe('GET');
    });
  });

  describe('Multiple paths', () => {
    it('should extract routes from all paths', () => {
      const doc = makeDocument({
        '/health': { get: {} },
        '/users': { get: { security: [{ bearer: [] }] } },
        '/api/plans': { get: { security: [{ 'api-key': [] }] } },
      });

      const routes = extractRouteSecurityInfo(doc);

      expect(routes).toHaveLength(3);
      expect(routes.map((r) => r.securityType)).toContain('public');
      expect(routes.map((r) => r.securityType)).toContain('jwt');
      expect(routes.map((r) => r.securityType)).toContain('partner');
    });
  });

  describe('Edge cases', () => {
    it('should return empty array for document with no paths', () => {
      const doc = makeDocument({});

      const routes = extractRouteSecurityInfo(doc);

      expect(routes).toEqual([]);
    });

    it('should treat unknown security schemes as public', () => {
      const doc = makeDocument({
        '/custom': {
          get: { security: [{ 'custom-scheme': [] }] },
        },
      });

      const routes = extractRouteSecurityInfo(doc);

      expect(routes).toEqual([
        { path: '/custom', method: 'GET', securityType: 'public' },
      ]);
    });
  });
});
