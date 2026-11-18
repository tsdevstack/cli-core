import { describe, it, expect } from '@rstest/core';
import { quotePgLiteral } from './quote-pg-literal';

describe('quotePgLiteral', () => {
  describe('Standard use cases', () => {
    it('should wrap a value in single quotes', () => {
      expect(quotePgLiteral('auth-service')).toBe("'auth-service'");
    });
  });

  describe('Edge cases', () => {
    it('should double single quotes', () => {
      expect(quotePgLiteral("it's'; DROP ROLE x; --")).toBe(
        "'it''s''; DROP ROLE x; --'",
      );
    });

    it('should leave backslashes and base64 characters as they are', () => {
      expect(quotePgLiteral('a\\b+/=')).toBe("'a\\b+/='");
    });

    it('should quote an empty value', () => {
      expect(quotePgLiteral('')).toBe("''");
    });
  });
});
