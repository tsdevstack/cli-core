import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { findScheduledJobEntries } from './find-scheduled-job-entries';

describe('findScheduledJobEntries', () => {
  let root: string;

  const writeInfra = (infra: unknown): void => {
    fs.mkdirSync(path.join(root, '.tsdevstack'), { recursive: true });
    fs.writeFileSync(
      path.join(root, '.tsdevstack/infrastructure.json'),
      JSON.stringify(infra),
    );
  };

  const cleanup = {
    name: 'cleanup-tokens',
    schedule: '0 0 * * *',
    targetService: 'auth-service',
    endpoint: '/auth/jobs/cleanup-tokens',
    method: 'POST',
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cron-entries-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  describe('Standard use cases', () => {
    it('should find the entry in every environment that has it', () => {
      writeInfra({
        dev: { scheduledJobs: [cleanup, { name: 'other' }] },
        prod: { scheduledJobs: [{ ...cleanup, schedule: '0 1 * * *' }] },
        staging: { database: { tier: 'x' } },
      });

      expect(findScheduledJobEntries(root, 'cleanup-tokens')).toEqual([
        { env: 'dev', entry: cleanup },
        { env: 'prod', entry: { ...cleanup, schedule: '0 1 * * *' } },
      ]);
    });

    it('should look in one environment only when asked', () => {
      writeInfra({
        dev: { scheduledJobs: [cleanup] },
        prod: { scheduledJobs: [cleanup] },
      });

      expect(findScheduledJobEntries(root, 'cleanup-tokens', 'prod')).toEqual([
        { env: 'prod', entry: cleanup },
      ]);
      expect(
        findScheduledJobEntries(root, 'cleanup-tokens', 'staging'),
      ).toEqual([]);
    });
  });

  describe('Edge cases', () => {
    it('should return nothing without an infrastructure.json', () => {
      expect(findScheduledJobEntries(root, 'cleanup-tokens')).toEqual([]);
    });

    it('should skip environments and lists that are not shaped as expected', () => {
      writeInfra({
        dev: 'nope',
        prod: { scheduledJobs: 'nope' },
        staging: { scheduledJobs: [null, 'x', cleanup] },
      });

      expect(findScheduledJobEntries(root, 'cleanup-tokens')).toEqual([
        { env: 'staging', entry: cleanup },
      ]);
    });
  });
});
