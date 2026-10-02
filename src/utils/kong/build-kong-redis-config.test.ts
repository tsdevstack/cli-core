import { describe, it, expect } from '@rstest/core';
import { buildKongRedisConfig } from './build-kong-redis-config';

describe('buildKongRedisConfig', () => {
  describe('Standard use cases', () => {
    it('should use the Redis secret placeholders', () => {
      expect(buildKongRedisConfig()).toEqual({
        host: '${REDIS_HOST}',
        port: '${REDIS_PORT}',
        password: '${REDIS_PASSWORD}',
        database: 0,
        timeout: 2000,
      });
    });
  });

  describe('Edge cases', () => {
    it('should return a new object on each call', () => {
      const first = buildKongRedisConfig();
      first.ssl = true;
      expect(buildKongRedisConfig().ssl).toBeUndefined();
    });
  });
});
