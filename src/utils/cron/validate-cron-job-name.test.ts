import { describe, it, expect } from '@rstest/core';
import { validateCronJobName } from './validate-cron-job-name';
import { CliError } from '../errors';

describe('validateCronJobName', () => {
  describe('Standard use cases', () => {
    it.each(['usage-report', 'a1', 'report2', 'cleanup-tokens-v2'])(
      'should accept %s',
      (name) => {
        expect(() => validateCronJobName(name)).not.toThrow();
      },
    );
  });

  describe('Edge cases', () => {
    it.each([
      ['Usage-Report', 'uppercase'],
      ['usage_report', 'underscores'],
      ['-usage', 'a leading hyphen'],
      ['usage-', 'a trailing hyphen'],
      ['usage--report', 'a double hyphen'],
      ['1usage', 'a leading digit'],
      ['usage report', 'a space'],
    ])('should reject %s (%s)', (name) => {
      expect(() => validateCronJobName(name)).toThrow(CliError);
      expect(() => validateCronJobName(name)).toThrow('must be kebab-case');
    });

    it('should reject a one-character name', () => {
      expect(() => validateCronJobName('a')).toThrow(
        'must be 2 to 40 characters long',
      );
    });

    it('should reject a name over 40 characters', () => {
      expect(() => validateCronJobName('a'.repeat(41))).toThrow(
        'must be 2 to 40 characters long',
      );
      expect(() => validateCronJobName('a'.repeat(40))).not.toThrow();
    });
  });
});
