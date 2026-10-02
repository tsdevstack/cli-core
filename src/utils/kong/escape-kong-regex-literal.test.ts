import { describe, it, expect } from '@rstest/core';
import { escapeKongRegexLiteral } from './escape-kong-regex-literal';

describe('escapeKongRegexLiteral', () => {
  describe('Standard use cases', () => {
    it('should leave plain path text unchanged', () => {
      expect(escapeKongRegexLiteral('/offers/v1/user/assign-plan')).toBe(
        '/offers/v1/user/assign-plan',
      );
    });

    it('should escape a dot', () => {
      expect(escapeKongRegexLiteral('/offers/v2.1/plans')).toBe(
        '/offers/v2\\.1/plans',
      );
    });
  });

  describe('Edge cases', () => {
    it('should escape every regex special character', () => {
      expect(escapeKongRegexLiteral('\\.^$|?*+()[]{}')).toBe(
        '\\\\\\.\\^\\$\\|\\?\\*\\+\\(\\)\\[\\]\\{\\}',
      );
    });

    it('should not escape characters without regex meaning', () => {
      expect(escapeKongRegexLiteral('/a-b_c~d:e@f!g,h;i=j&k')).toBe(
        '/a-b_c~d:e@f!g,h;i=j&k',
      );
    });

    it('should produce a pattern that matches only the literal', () => {
      const pattern = new RegExp(`^${escapeKongRegexLiteral('/v2.1/a+b')}$`);
      expect(pattern.test('/v2.1/a+b')).toBe(true);
      expect(pattern.test('/v2X1/a+b')).toBe(false);
      expect(pattern.test('/v2.1/aab')).toBe(false);
    });
  });
});
