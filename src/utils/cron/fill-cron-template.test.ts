import { describe, it, expect } from '@rstest/core';
import { fillCronTemplate } from './fill-cron-template';
import { CliError } from '../errors';

describe('fillCronTemplate', () => {
  describe('Standard use cases', () => {
    it('should fill every mark, repeated ones too', () => {
      const out = fillCronTemplate(
        "import { {{CLASS}} } from './{{NAME}}';\nconst handlers = [{{CLASS}}];",
        { CLASS: 'ReportCron', NAME: 'report.cron' },
      );
      expect(out).toBe(
        "import { ReportCron } from './report.cron';\nconst handlers = [ReportCron];",
      );
    });

    it('should remove a mark whose value is empty', () => {
      expect(fillCronTemplate('a{{X}}b', { X: '' })).toBe('ab');
    });

    it('should leave text without marks alone', () => {
      expect(fillCronTemplate('plain {text}', {})).toBe('plain {text}');
    });
  });

  describe('Edge cases', () => {
    it('should throw a CliError for a mark without a value', () => {
      expect(() =>
        fillCronTemplate('{{KNOWN}} {{UNKNOWN}}', { KNOWN: 'x' }),
      ).toThrow(CliError);
      expect(() => fillCronTemplate('{{UNKNOWN}}', {})).toThrow(
        'Cron template has an unknown placeholder: {{UNKNOWN}}',
      );
    });
  });
});
