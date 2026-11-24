import { describe, it, expect } from '@rstest/core';
import { buildCronClassName } from './build-cron-class-name';

describe('buildCronClassName', () => {
  describe('Standard use cases', () => {
    it('should turn a kebab-case name into a PascalCase class with the Cron suffix', () => {
      expect(buildCronClassName('usage-report')).toBe('UsageReportCron');
    });

    it('should handle a one-word name', () => {
      expect(buildCronClassName('report')).toBe('ReportCron');
    });

    it('should keep digits', () => {
      expect(buildCronClassName('cleanup-tokens-v2')).toBe(
        'CleanupTokensV2Cron',
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle a one-letter name', () => {
      expect(buildCronClassName('a')).toBe('ACron');
    });
  });
});
