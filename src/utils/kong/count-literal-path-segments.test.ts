import { describe, it, expect } from '@rstest/core';
import { countLiteralPathSegments } from './count-literal-path-segments';

describe('countLiteralPathSegments', () => {
  describe('Standard use cases', () => {
    it('should count every segment of a literal path', () => {
      expect(countLiteralPathSegments('/offers/v1/plans')).toBe(3);
    });

    it('should not count parameter segments', () => {
      expect(countLiteralPathSegments('/offers/v1/plans/{id}')).toBe(3);
    });

    it('should rank a literal above a parameter at the same position', () => {
      expect(countLiteralPathSegments('/offers/v1/plans/featured')).toBe(4);
      expect(
        countLiteralPathSegments('/offers/v1/plans/featured'),
      ).toBeGreaterThan(countLiteralPathSegments('/offers/v1/plans/{id}'));
    });
  });

  describe('Edge cases', () => {
    it('should return 0 for the root path', () => {
      expect(countLiteralPathSegments('/')).toBe(0);
    });

    it('should not count a segment with an embedded parameter', () => {
      expect(countLiteralPathSegments('/files/{name}.json')).toBe(1);
    });
  });
});
