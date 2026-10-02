import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('../logger', () => ({
  logger: { warn: rs.fn() },
}));

import { validateRequestTransformerHeaders } from './validate-request-transformer-headers';
import { getDefaultKongPlugins } from './default-plugins';
import { logger } from '../logger';
import type { KongPlugin, KongTemplate } from './types';

function transformer(headers: unknown): KongPlugin {
  return {
    name: 'request-transformer',
    config: {
      remove: { headers },
      add: { headers: ['X-Kong-Trust:${KONG_TRUST_TOKEN}'] },
    },
  };
}

describe('validateRequestTransformerHeaders', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should accept the default request-transformer', () => {
      const config: KongTemplate = {
        services: [],
        plugins: getDefaultKongPlugins(),
      };

      expect(
        validateRequestTransformerHeaders(config, 'kong.user.yml'),
      ).toEqual([]);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should warn about the old default that removed consumer headers', () => {
      const config: KongTemplate = {
        services: [],
        plugins: [
          transformer([
            'X-Consumer-Id',
            'X-Consumer-Username',
            'X-JWT-Claim-Sub',
            'X-Kong-Request-Id',
            'X-Kong-Trust',
          ]),
        ],
      };

      expect(
        validateRequestTransformerHeaders(config, 'kong.user.yml'),
      ).toEqual(['X-Consumer-Id', 'X-Consumer-Username']);
      expect(logger.warn).toHaveBeenCalledWith(
        'kong.user.yml: request-transformer removes identity headers: X-Consumer-Id, X-Consumer-Username',
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('@Partner() gets no consumer'),
      );
    });

    it('should compare header names case-insensitively', () => {
      const config: KongTemplate = {
        services: [],
        plugins: [transformer(['x-userinfo', 'X-CREDENTIAL-IDENTIFIER'])],
      };

      expect(validateRequestTransformerHeaders(config, 'f')).toEqual([
        'x-userinfo',
        'X-CREDENTIAL-IDENTIFIER',
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should check service-level and consumer-level request-transformers', () => {
      const config: KongTemplate = {
        services: [
          {
            name: 'custom',
            url: 'http://x',
            routes: [],
            plugins: [transformer(['X-Api-Key-Id'])],
          },
        ],
        consumers: [
          { username: 'p', plugins: [transformer(['X-Consumer-Custom-ID'])] },
        ],
      };

      expect(validateRequestTransformerHeaders(config, 'f')).toEqual([
        'X-Api-Key-Id',
        'X-Consumer-Custom-ID',
      ]);
    });

    it('should not flag X-Kong-Trust or other plugins', () => {
      const config: KongTemplate = {
        services: [],
        plugins: [
          transformer(['X-Kong-Trust']),
          {
            name: 'response-transformer',
            config: { remove: { headers: ['X-Userinfo'] } },
          },
        ],
      };

      expect(validateRequestTransformerHeaders(config, 'f')).toEqual([]);
    });

    it('should ignore a malformed remove list', () => {
      const config: KongTemplate = {
        services: [],
        plugins: [transformer('X-Userinfo'), transformer([42, null])],
      };

      expect(validateRequestTransformerHeaders(config, 'f')).toEqual([]);
    });

    it('should report each header once', () => {
      const config: KongTemplate = {
        services: [],
        plugins: [transformer(['X-Userinfo']), transformer(['X-Userinfo'])],
      };

      expect(validateRequestTransformerHeaders(config, 'f')).toEqual([
        'X-Userinfo',
      ]);
    });
  });
});
