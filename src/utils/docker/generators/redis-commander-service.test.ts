import { describe, it, expect } from '@rstest/core';
import { generateRedisCommanderService } from './redis-commander-service';

describe('generateRedisCommanderService', () => {
  it('should generate redis-commander service config', () => {
    const result = generateRedisCommanderService('test-network');

    expect(result).toHaveProperty('redis-commander');
    const service = result['redis-commander'];
    expect(service.image).toBe('rediscommander/redis-commander:latest');
    expect(service.restart).toBe('always');
    expect(service.networks).toEqual(['test-network']);
  });

  it('should use linux/amd64 platform', () => {
    const result = generateRedisCommanderService('net');

    expect(result['redis-commander'].platform).toBe('linux/amd64');
  });

  it('should expose port 8081', () => {
    const result = generateRedisCommanderService('net');

    expect(result['redis-commander'].ports).toEqual(['8081:8081']);
  });

  it('should configure redis connection with password env var', () => {
    const result = generateRedisCommanderService('net');
    const env = result['redis-commander'].environment as string[];

    expect(env).toEqual(['REDIS_HOSTS=local:redis:6379:0:${REDIS_PASSWORD}']);
  });

  it('should depend on redis', () => {
    const result = generateRedisCommanderService('net');

    expect(result['redis-commander'].depends_on).toEqual(['redis']);
  });

  it('should include healthcheck with long interval', () => {
    const result = generateRedisCommanderService('net');
    const hc = result['redis-commander'].healthcheck!;

    expect(hc.interval).toBe('1h');
    expect(hc.start_period).toBe('10s');
  });
});
