import { describe, it, expect } from '@rstest/core';
import { validateKongTrustTokenUse } from './validate-kong-trust-token-use';
import { CliError } from '../errors';
import type { KongTemplate } from './types';

const config = (overrides: Partial<KongTemplate>): KongTemplate => ({
  services: [],
  ...overrides,
});

describe('validateKongTrustTokenUse', () => {
  describe('Standard use cases', () => {
    it('should accept the token in tsdevstack-trust', () => {
      expect(() =>
        validateKongTrustTokenUse(
          config({
            plugins: [
              {
                name: 'tsdevstack-trust',
                config: {
                  token: '${KONG_TRUST_TOKEN}',
                  header: 'X-Kong-Trust',
                },
              },
            ],
          }),
          'kong.yml',
        ),
      ).not.toThrow();
    });

    it('should stop a request-transformer that still adds the trust header', () => {
      const legacy = config({
        plugins: [
          {
            name: 'request-transformer',
            config: {
              remove: { headers: ['X-Kong-Request-Id', 'X-Kong-Trust'] },
              add: { headers: ['X-Kong-Trust:${KONG_TRUST_TOKEN}'] },
            },
          },
        ],
      });

      expect(() => validateKongTrustTokenUse(legacy, 'kong.user.yml')).toThrow(
        CliError,
      );
      expect(() => validateKongTrustTokenUse(legacy, 'kong.user.yml')).toThrow(
        'kong.user.yml: request-transformer uses ${KONG_TRUST_TOKEN}',
      );
    });
  });

  describe('Edge cases', () => {
    it('should find the token in service and route plugins', () => {
      const nested = {
        services: [
          {
            name: 'offers',
            url: 'http://offers',
            routes: [
              {
                name: 'r',
                strip_path: false,
                plugins: [
                  {
                    name: 'pre-function',
                    config: { access: ['-- ${KONG_TRUST_TOKEN}'] },
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as KongTemplate;

      expect(() =>
        validateKongTrustTokenUse(nested, 'kong.custom.yml'),
      ).toThrow('kong.custom.yml: pre-function uses ${KONG_TRUST_TOKEN}');
    });

    it('should accept a config without the token', () => {
      expect(() =>
        validateKongTrustTokenUse(
          config({
            plugins: [
              {
                name: 'rate-limiting',
                config: { redis: { password: '${REDIS_PASSWORD}' } },
              },
            ],
          }),
          'kong.user.yml',
        ),
      ).not.toThrow();
    });
  });
});
