import { describe, it, expect } from '@rstest/core';
import { buildCronJobEntry } from './build-cron-job-entry';

describe('buildCronJobEntry', () => {
  it('should build the entry with the defaults filled in and an example schedule', () => {
    expect(buildCronJobEntry('usage-report', 'auth-service')).toEqual({
      name: 'usage-report',
      type: 'cron',
      schedule: '0 3 * * *',
      targetService: 'auth-service',
      timeout: 600,
    });
  });
});
