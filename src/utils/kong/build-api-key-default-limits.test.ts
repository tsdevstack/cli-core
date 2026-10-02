import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { buildApiKeyDefaultLimits } from './build-api-key-default-limits';
import { logger } from '../logger';
import type { KongPlugin, KongTemplate } from './types';

rs.mock('../logger', () => ({
  logger: { info: rs.fn(), warn: rs.fn() },
}));

function userConfig(...plugins: KongPlugin[]): KongTemplate {
  return { _format_version: '3.0', services: [], plugins };
}

const cors: KongPlugin = { name: 'cors', config: { origins: ['*'] } };

describe('buildApiKeyDefaultLimits', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should copy minute, hour, day and month from the global rate-limiting', () => {
      expect(
        buildApiKeyDefaultLimits(
          userConfig(cors, {
            name: 'rate-limiting',
            config: {
              minute: 100,
              hour: 2000,
              day: 10000,
              month: 100000,
              policy: 'redis',
            },
          }),
        ),
      ).toEqual({ minute: 100, hour: 2000, day: 10000, month: 100000 });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should copy only the windows that are set (the default kong.user.yml: minute)', () => {
      expect(
        buildApiKeyDefaultLimits(
          userConfig({ name: 'rate-limiting', config: { minute: 100 } }),
        ),
      ).toEqual({ minute: 100 });
    });

    it('should keep a placeholder as written (resolved like the global limiter)', () => {
      expect(
        buildApiKeyDefaultLimits(
          userConfig({
            name: 'rate-limiting',
            config: { hour: '${RATE_LIMIT_HOUR}' },
          }),
        ),
      ).toEqual({ hour: '${RATE_LIMIT_HOUR}' });
    });
  });

  describe('Unsupported windows', () => {
    it('should warn about and ignore second and year', () => {
      expect(
        buildApiKeyDefaultLimits(
          userConfig({
            name: 'rate-limiting',
            config: { second: 5, minute: 100, year: 1000000 },
          }),
        ),
      ).toEqual({ minute: 100 });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('sets second, year'),
      );
    });

    it('should not warn for null windows', () => {
      buildApiKeyDefaultLimits(
        userConfig({
          name: 'rate-limiting',
          config: { second: null, minute: 100 },
        }),
      );
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('No global limiter', () => {
    it('should return no limits and print an info line without kong.user.yml', () => {
      expect(buildApiKeyDefaultLimits(undefined)).toEqual({});
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('only limited by the per-IP ceiling'),
      );
    });

    it('should return no limits without a rate-limiting plugin', () => {
      expect(buildApiKeyDefaultLimits(userConfig(cors))).toEqual({});
    });

    it('should ignore a disabled global rate-limiting', () => {
      expect(
        buildApiKeyDefaultLimits(
          userConfig({
            name: 'rate-limiting',
            enabled: false,
            config: { minute: 100 },
          }),
        ),
      ).toEqual({});
    });

    it('should ignore a rate-limiting scoped to a service, route or consumer', () => {
      for (const scope of ['service', 'route', 'consumer']) {
        const plugin = {
          name: 'rate-limiting',
          [scope]: 'something',
          config: { minute: 100 },
        } as KongPlugin;
        expect(buildApiKeyDefaultLimits(userConfig(plugin))).toEqual({});
      }
    });
  });
});
