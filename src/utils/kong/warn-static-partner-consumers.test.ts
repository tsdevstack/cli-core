import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { warnStaticPartnerConsumers } from './warn-static-partner-consumers';
import { logger } from '../logger';

rs.mock('../logger', () => ({
  logger: { warn: rs.fn() },
}));

describe('warnStaticPartnerConsumers', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should warn once about consumers with keyauth_credentials', () => {
      const result = warnStaticPartnerConsumers(
        {
          services: [],
          consumers: [
            {
              username: 'acme',
              keyauth_credentials: [{ key: '${ACME_KEY}' }],
            },
            { username: 'other', keyauth_credentials: [{ key: 'k' }] },
            { username: 'no-keys' },
          ],
        },
        'kong.user.yml',
      );

      expect(result).toEqual(['acme', 'other']);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'kong.user.yml: consumers with keyauth_credentials (acme, other): static partner keys are no longer supported',
        ),
      );
      expect(
        (logger.warn as ReturnType<typeof rs.fn>).mock.calls.filter((call) =>
          String(call[0]).includes('keyauth_credentials'),
        ),
      ).toHaveLength(1);
    });
  });

  describe('Edge cases', () => {
    it('should not warn without consumers', () => {
      expect(
        warnStaticPartnerConsumers({ services: [] }, 'kong.user.yml'),
      ).toEqual([]);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should not warn for consumers without credentials or with an empty list', () => {
      expect(
        warnStaticPartnerConsumers(
          {
            services: [],
            consumers: [
              { username: 'a' },
              { username: 'b', keyauth_credentials: [] },
            ],
          },
          'kong.user.yml',
        ),
      ).toEqual([]);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });
});
