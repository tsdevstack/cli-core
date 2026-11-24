/**
 * Tests for runCron command
 */

import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('node:fs', { mock: true });
rs.mock('../utils/logger', { mock: true });
rs.mock('../utils/config', { mock: true });
rs.mock('../utils/paths', { mock: true });
rs.mock('../utils/cron', { mock: true });

import fs from 'node:fs';
import { logger } from '../utils/logger';
import { loadFrameworkConfig } from '../utils/config';
import { findProjectRoot } from '../utils/paths';
import {
  callTriggerLocally,
  findCronHandlerServices,
  findScheduledJobEntries,
  runCronJobLocally,
} from '../utils/cron';
import { CliError } from '../utils/errors';
import { createMockFrameworkConfig } from '../test-fixtures/framework-config';
import { runCron } from './run-cron';

const HANDLER = '/project/apps/auth-service/src/cron/usage-report.cron.ts';

const trigger = {
  name: 'cleanup-tokens',
  targetService: 'auth-service',
  endpoint: '/auth/jobs/cleanup-tokens',
  method: 'POST',
};

describe('runCron', () => {
  const services = [
    { name: 'auth-service', type: 'nestjs', port: 3001 },
    { name: 'bff-service', type: 'nestjs', port: 3002 },
    { name: 'frontend', type: 'nextjs', port: 4000 },
  ];

  beforeEach(() => {
    rs.resetAllMocks();
    rs.mocked(findProjectRoot).mockReturnValue('/project');
    rs.mocked(loadFrameworkConfig).mockReturnValue(
      createMockFrameworkConfig({ services }),
    );
    rs.mocked(fs.existsSync).mockImplementation((p) => String(p) === HANDLER);
    rs.mocked(findCronHandlerServices).mockReturnValue([]);
    rs.mocked(findScheduledJobEntries).mockReturnValue([]);
  });

  describe('A cron job', () => {
    it('should run the handler of the given service', async () => {
      await runCron('usage-report', { service: 'auth-service' });

      expect(runCronJobLocally).toHaveBeenCalledWith(
        '/project',
        'auth-service',
        'usage-report',
      );
      expect(callTriggerLocally).not.toHaveBeenCalled();
      expect(findScheduledJobEntries).not.toHaveBeenCalled();
    });

    it('should find the service by the handler file when --service is not given', async () => {
      rs.mocked(findCronHandlerServices).mockReturnValue(['auth-service']);

      await runCron('usage-report', {});

      expect(findCronHandlerServices).toHaveBeenCalledWith(
        '/project',
        'usage-report',
        services,
      );
      expect(runCronJobLocally).toHaveBeenCalledWith(
        '/project',
        'auth-service',
        'usage-report',
      );
    });

    it('should refuse to pick when several services have the handler, naming them', async () => {
      rs.mocked(findCronHandlerServices).mockReturnValue([
        'auth-service',
        'bff-service',
      ]);

      await expect(runCron('usage-report', {})).rejects.toThrow(CliError);
      await expect(runCron('usage-report', {})).rejects.toThrow(
        'Several services have a cron job named "usage-report": auth-service, bff-service',
      );
      expect(runCronJobLocally).not.toHaveBeenCalled();
    });

    it('should throw for an unknown --service', async () => {
      await expect(
        runCron('usage-report', { service: 'nope-service' }),
      ).rejects.toThrow('Service "nope-service" not found in framework config');
    });
  });

  describe('A trigger', () => {
    it('should call the entry when no handler file exists', async () => {
      rs.mocked(findScheduledJobEntries).mockReturnValue([
        { env: 'dev', entry: trigger },
      ]);

      await runCron('cleanup-tokens', {});

      expect(findScheduledJobEntries).toHaveBeenCalledWith(
        '/project',
        'cleanup-tokens',
        undefined,
      );
      expect(callTriggerLocally).toHaveBeenCalledWith(
        services,
        'cleanup-tokens',
        'dev',
        trigger,
      );
      expect(runCronJobLocally).not.toHaveBeenCalled();
    });

    it('should pass --env on', async () => {
      rs.mocked(findScheduledJobEntries).mockReturnValue([
        { env: 'prod', entry: trigger },
      ]);

      await runCron('cleanup-tokens', { env: 'prod' });

      expect(findScheduledJobEntries).toHaveBeenCalledWith(
        '/project',
        'cleanup-tokens',
        'prod',
      );
      expect(callTriggerLocally).toHaveBeenCalledWith(
        services,
        'cleanup-tokens',
        'prod',
        trigger,
      );
    });

    it('should use the first environment and say so when several have the entry', async () => {
      rs.mocked(findScheduledJobEntries).mockReturnValue([
        { env: 'dev', entry: trigger },
        { env: 'prod', entry: trigger },
      ]);

      await runCron('cleanup-tokens', {});

      expect(logger.info).toHaveBeenCalledWith(
        '"cleanup-tokens" is in dev, prod; using the dev entry (pick one with --env)',
      );
      expect(callTriggerLocally).toHaveBeenCalledWith(
        services,
        'cleanup-tokens',
        'dev',
        trigger,
      );
    });

    it('should prefer a handler file over an entry of the same name', async () => {
      rs.mocked(findCronHandlerServices).mockReturnValue(['auth-service']);
      rs.mocked(findScheduledJobEntries).mockReturnValue([
        { env: 'dev', entry: { ...trigger, name: 'usage-report' } },
      ]);

      await runCron('usage-report', {});

      expect(runCronJobLocally).toHaveBeenCalled();
      expect(callTriggerLocally).not.toHaveBeenCalled();
    });
  });

  describe('Nothing to run', () => {
    it('should throw when neither a handler nor an entry exists', async () => {
      await expect(runCron('nope', {})).rejects.toThrow(CliError);
      await expect(runCron('nope', {})).rejects.toThrow(
        'No scheduled job named "nope"',
      );
    });

    it('should name the service when --service was given and nothing was found', async () => {
      await expect(
        runCron('nope', { service: 'bff-service', env: 'dev' }),
      ).rejects.toMatchObject({
        message: 'No scheduled job named "nope"',
        hint: expect.stringContaining(
          'No apps/bff-service/src/cron/nope.cron.ts, and no entry of that name in .tsdevstack/infrastructure.json (dev)',
        ),
      });
    });

    it('should point at register-cron for a cron entry without a handler file', async () => {
      rs.mocked(findScheduledJobEntries).mockReturnValue([
        {
          env: 'dev',
          entry: {
            name: 'usage-report',
            type: 'cron',
            targetService: 'bff-service',
          },
        },
      ]);

      await expect(runCron('usage-report', {})).rejects.toThrow(
        'Cron job "usage-report" (dev) has no handler file in apps/bff-service',
      );
      expect(callTriggerLocally).not.toHaveBeenCalled();
    });
  });
});
