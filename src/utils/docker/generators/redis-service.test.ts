import { describe, it, expect } from '@rstest/core';
import { generateRedisService } from './redis-service';

describe('generateRedisService', () => {
  it('should generate redis service config', () => {
    const result = generateRedisService('test-network');

    expect(result).toHaveProperty('redis');
    const service = result.redis;
    expect(service.image).toBe('redis:7-alpine');
    expect(service.restart).toBe('always');
    expect(service.networks).toEqual(['test-network']);
  });

  it('should expose port 6379', () => {
    const result = generateRedisService('net');

    expect(result.redis.ports).toEqual(['6379:6379']);
  });

  it('should configure password-protected server', () => {
    const result = generateRedisService('net');

    expect(result.redis.command).toBe(
      'redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}',
    );
  });

  it('should set redis password environment variable', () => {
    const result = generateRedisService('net');
    const env = result.redis.environment as string[];

    expect(env).toEqual(['REDIS_PASSWORD=${REDIS_PASSWORD}']);
  });

  it('should mount data volume for persistence', () => {
    const result = generateRedisService('net');

    expect(result.redis.volumes).toEqual(['./data/redis:/data']);
  });
});
