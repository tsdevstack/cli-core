import { describe, it, expect } from '@rstest/core';
import { generateIpCeilingPlugin } from './generate-ip-ceiling-plugin';

describe('generateIpCeilingPlugin', () => {
  describe('Standard use cases', () => {
    it('should limit per IP per minute through Redis, client headers shown (hiding them breaks 429 on kong:3.8.0)', () => {
      expect(generateIpCeilingPlugin(600)).toEqual({
        name: 'rate-limiting',
        config: {
          minute: 600,
          limit_by: 'ip',
          policy: 'redis',
          hide_client_headers: false,
          redis: {
            host: '${REDIS_HOST}',
            port: '${REDIS_PORT}',
            password: '${REDIS_PASSWORD}',
            database: 0,
            timeout: 2000,
          },
        },
      });
    });
  });

  describe('Edge cases', () => {
    it('should use the given limit', () => {
      expect(generateIpCeilingPlugin(5).config.minute).toBe(5);
    });
  });
});
