import { describe, it, expect } from '@rstest/core';
import { generateApiKeyPlugin } from './generate-api-key-plugin';

describe('generateApiKeyPlugin', () => {
  describe('Standard use cases', () => {
    it('should read x-api-key, use the Redis placeholders and the default limits', () => {
      expect(generateApiKeyPlugin({ minute: 100, month: 5000 })).toEqual({
        name: 'tsdevstack-api-key',
        config: {
          key_names: ['x-api-key'],
          redis: {
            host: '${REDIS_HOST}',
            port: '${REDIS_PORT}',
            password: '${REDIS_PASSWORD}',
            database: 0,
            timeout: 2000,
          },
          default_limits: { minute: 100, month: 5000 },
        },
      });
    });
  });

  describe('Edge cases', () => {
    it('should emit empty default_limits without a global limiter', () => {
      expect(generateApiKeyPlugin({}).config.default_limits).toEqual({});
    });

    it('should not share objects with the input or between calls', () => {
      const limits = { minute: 1 };
      const plugin = generateApiKeyPlugin(limits);
      plugin.config.default_limits.minute = 2;
      plugin.config.key_names.push('x-other');
      expect(limits.minute).toBe(1);
      expect(generateApiKeyPlugin(limits).config.key_names).toEqual([
        'x-api-key',
      ]);
    });
  });
});
