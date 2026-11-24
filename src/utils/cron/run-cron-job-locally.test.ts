import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';

rs.mock('node:fs', { mock: true });
rs.mock('node:child_process', { mock: true });
rs.mock('../logger', { mock: true });

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { logger } from '../logger';
import { runCronJobLocally } from './run-cron-job-locally';
import { CliError } from '../errors';

function infoLines(): string[] {
  return rs.mocked(logger.info).mock.calls.map(([line]) => String(line));
}

describe('runCronJobLocally', () => {
  beforeEach(() => {
    rs.resetAllMocks();
    process.exitCode = undefined;
    rs.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ scripts: { cron: 'nest start --entryFile cron --' } }),
    );
    rs.mocked(spawnSync).mockReturnValue({
      status: 0,
    } as ReturnType<typeof spawnSync>);
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  describe('Standard use cases', () => {
    it("should run the service's cron script with the name, output passed through", () => {
      runCronJobLocally('/project', 'auth-service', 'usage-report');

      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/project/apps/auth-service/package.json',
        'utf-8',
      );
      expect(spawnSync).toHaveBeenCalledWith(
        'npm',
        ['run', 'cron', '--', 'usage-report'],
        { cwd: '/project/apps/auth-service', stdio: 'inherit' },
      );
      expect(logger.success).toHaveBeenCalledWith(
        'Cron job "usage-report" finished (exit 0)',
      );
      expect(process.exitCode).toBeUndefined();
    });

    it("should take the run's exit code", () => {
      rs.mocked(spawnSync).mockReturnValue({
        status: 1,
      } as ReturnType<typeof spawnSync>);

      runCronJobLocally('/project', 'auth-service', 'usage-report');

      expect(logger.error).toHaveBeenCalledWith(
        'Cron job "usage-report" exited with code 1',
      );
      expect(process.exitCode).toBe(1);
      expect(infoLines().some((l) => l.includes('import {'))).toBe(false);
    });

    it('should print the two module lines when the job never started (exit 2)', () => {
      rs.mocked(spawnSync).mockReturnValue({
        status: 2,
      } as ReturnType<typeof spawnSync>);

      runCronJobLocally('/project', 'auth-service', 'usage-report');

      const lines = infoLines();
      expect(lines).toContain(
        "Exit 2 means the job never started. If the handler isn't listed in apps/auth-service/src/cron.module.ts, add:",
      );
      expect(lines).toContain(
        "  import { UsageReportCron } from './cron/usage-report.cron';",
      );
      expect(lines).toContain('  UsageReportCron,   (in the handlers list)');
      expect(process.exitCode).toBe(2);
    });
  });

  describe('Edge cases', () => {
    it('should treat a run without a status (killed) as exit 1', () => {
      rs.mocked(spawnSync).mockReturnValue({
        status: null,
        signal: 'SIGKILL',
      } as unknown as ReturnType<typeof spawnSync>);

      runCronJobLocally('/project', 'auth-service', 'usage-report');

      expect(process.exitCode).toBe(1);
    });

    it('should throw when the service has no cron script', () => {
      rs.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ scripts: { build: 'nest build' } }),
      );

      expect(() =>
        runCronJobLocally('/project', 'auth-service', 'usage-report'),
      ).toThrow(CliError);
      expect(() =>
        runCronJobLocally('/project', 'auth-service', 'usage-report'),
      ).toThrow('apps/auth-service/package.json has no "cron" script');
      expect(spawnSync).not.toHaveBeenCalled();
    });
  });
});
