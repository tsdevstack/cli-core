import { describe, it, expect } from '@rstest/core';
import { openApiPathToKongRegex } from './openapi-path-to-kong-regex';

/** Kong prefixes the regex with ^ (router/transform.lua path_val_transform) */
function kongMatches(kongPath: string, requestPath: string): boolean {
  return new RegExp(`^${kongPath.slice(1)}`).test(requestPath);
}

describe('openApiPathToKongRegex', () => {
  describe('Standard use cases', () => {
    it('should anchor a literal path', () => {
      expect(openApiPathToKongRegex('/offers/v1/plans')).toBe(
        '~/offers/v1/plans$',
      );
    });

    it('should turn a parameter into a single-segment pattern', () => {
      expect(openApiPathToKongRegex('/offers/v1/plans/{id}')).toBe(
        '~/offers/v1/plans/[^/]+$',
      );
    });

    it('should put the prefix in front (partner routes)', () => {
      expect(openApiPathToKongRegex('/offers/v1/plans/{id}', '/api')).toBe(
        '~/api/offers/v1/plans/[^/]+$',
      );
    });

    it('should escape literal segments', () => {
      expect(openApiPathToKongRegex('/offers/v2.1/user/active-plan')).toBe(
        '~/offers/v2\\.1/user/active-plan$',
      );
    });
  });

  describe('Matching behavior', () => {
    const route = openApiPathToKongRegex('/offers/v1/plans/{id}');

    it('should match exactly one parameter segment', () => {
      expect(kongMatches(route, '/offers/v1/plans/123')).toBe(true);
      expect(kongMatches(route, '/offers/v1/plans/12%2F3')).toBe(true);
    });

    it('should not match extra segments, an empty parameter or a trailing slash', () => {
      expect(kongMatches(route, '/offers/v1/plans/123/extra')).toBe(false);
      expect(kongMatches(route, '/offers/v1/plans/')).toBe(false);
      expect(kongMatches(route, '/offers/v1/plans/123/')).toBe(false);
      expect(kongMatches(route, '/offers/v1/plans')).toBe(false);
    });

    it('should not match a longer literal', () => {
      const literal = openApiPathToKongRegex('/offers/v1/plans');
      expect(kongMatches(literal, '/offers/v1/plansX')).toBe(false);
      expect(kongMatches(literal, '/offers/v1/plans/anything')).toBe(false);
    });

    it('should not let an escaped dot match another character', () => {
      const versioned = openApiPathToKongRegex('/offers/v2.1/user/active-plan');
      expect(kongMatches(versioned, '/offers/v2.1/user/active-plan')).toBe(
        true,
      );
      expect(kongMatches(versioned, '/offers/v2X1/user/active-plan')).toBe(
        false,
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle several parameters', () => {
      expect(openApiPathToKongRegex('/a/{x}/b/{y}')).toBe('~/a/[^/]+/b/[^/]+$');
    });

    it('should handle a parameter inside a segment', () => {
      expect(openApiPathToKongRegex('/files/{name}.json')).toBe(
        '~/files/[^/]+\\.json$',
      );
    });

    it('should handle the root path', () => {
      expect(openApiPathToKongRegex('/')).toBe('~/$');
    });
  });
});
