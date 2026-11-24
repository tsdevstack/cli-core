import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('./find-cron-handler-services', { mock: true });
rs.mock('./find-scheduled-job-entries', { mock: true });

import { findCronHandlerServices } from './find-cron-handler-services';
import { findScheduledJobEntries } from './find-scheduled-job-entries';
import { assertCronJobNameFree } from './assert-cron-job-name-free';
import { CliError } from '../errors';

const services = [
  { name: 'auth-service', type: 'nestjs' },
  { name: 'bff-service', type: 'nestjs' },
];

describe('assertCronJobNameFree', () => {
  beforeEach(() => {
    rs.resetAllMocks();
    rs.mocked(findCronHandlerServices).mockReturnValue([]);
    rs.mocked(findScheduledJobEntries).mockReturnValue([]);
  });

  describe('Standard use cases', () => {
    it('should accept a name nobody uses', () => {
      expect(() =>
        assertCronJobNameFree('/project', 'auth-service', 'report', services),
      ).not.toThrow();
      expect(findCronHandlerServices).toHaveBeenCalledWith(
        '/project',
        'report',
        services,
      );
      expect(findScheduledJobEntries).toHaveBeenCalledWith(
        '/project',
        'report',
      );
    });

    it('should accept a rerun: this service has the handler and the cron entry', () => {
      rs.mocked(findCronHandlerServices).mockReturnValue(['auth-service']);
      rs.mocked(findScheduledJobEntries).mockReturnValue([
        {
          env: 'dev',
          entry: {
            name: 'report',
            type: 'cron',
            targetService: 'auth-service',
          },
        },
      ]);

      expect(() =>
        assertCronJobNameFree('/project', 'auth-service', 'report', services),
      ).not.toThrow();
    });
  });

  describe('Taken names', () => {
    it('should refuse a name another service has a handler file for', () => {
      rs.mocked(findCronHandlerServices).mockReturnValue(['bff-service']);

      expect(() =>
        assertCronJobNameFree('/project', 'auth-service', 'report', services),
      ).toThrow(CliError);
      expect(() =>
        assertCronJobNameFree('/project', 'auth-service', 'report', services),
      ).toThrow(
        'Cron job name "report" is taken: bff-service already has src/cron/report.cron.ts',
      );
    });

    it("should refuse a trigger's name", () => {
      rs.mocked(findScheduledJobEntries).mockReturnValue([
        {
          env: 'dev',
          entry: {
            name: 'report',
            targetService: 'auth-service',
            endpoint: '/auth/jobs/report',
          },
        },
      ]);

      expect(() =>
        assertCronJobNameFree('/project', 'auth-service', 'report', services),
      ).toThrow(
        'Scheduled job name "report" is taken in infrastructure.json: dev (trigger)',
      );
    });

    it("should refuse another service's cron job name, naming every environment", () => {
      rs.mocked(findScheduledJobEntries).mockReturnValue([
        {
          env: 'dev',
          entry: { name: 'report', type: 'cron', targetService: 'bff-service' },
        },
        {
          env: 'prod',
          entry: { name: 'report', type: 'cron', targetService: 'bff-service' },
        },
      ]);

      expect(() =>
        assertCronJobNameFree('/project', 'auth-service', 'report', services),
      ).toThrow(
        'taken in infrastructure.json: dev (cron job of bff-service), prod (cron job of bff-service)',
      );
    });
  });
});
