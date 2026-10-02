import { describe, it, expect } from '@rstest/core';
import { generateKongService } from './kong-service';

describe('generateKongService', () => {
  it('should generate kong gateway service config', () => {
    const result = generateKongService('test-network');

    expect(result).toHaveProperty('gateway');
    const service = result.gateway;
    expect(service.image).toBe('tsdevstack-kong:latest');
    expect(service.networks).toEqual(['test-network']);
  });

  it('should use local build context', () => {
    const result = generateKongService('net');

    expect(result.gateway.build).toEqual({
      context: './infrastructure/kong',
      dockerfile: 'Dockerfile',
    });
  });

  it('should configure Kong in DB-less mode', () => {
    const result = generateKongService('net');
    const env = result.gateway.environment as Record<string, string>;

    expect(env.KONG_DATABASE).toBe('off');
    expect(env.KONG_DECLARATIVE_CONFIG).toBe('/kong/kong.yml');
  });

  it('should override the image defaults (proxy 8080, Admin API off) for local development', () => {
    const result = generateKongService('net');
    const env = result.gateway.environment as Record<string, string>;

    expect(env.KONG_PROXY_LISTEN).toBe('0.0.0.0:8000');
    expect(env.KONG_ADMIN_LISTEN).toBe('0.0.0.0:8001');
  });

  it("should restore Kong's default request body limit (0, unlimited) instead of the baked cloud maxUploadSize", () => {
    const result = generateKongService('net');
    const env = result.gateway.environment as Record<string, string>;

    expect(env.KONG_NGINX_HTTP_CLIENT_MAX_BODY_SIZE).toBe('0');
  });

  it('should expose proxy and admin ports', () => {
    const result = generateKongService('net');

    expect(result.gateway.ports).toEqual(['8000:8000', '8001:8001']);
  });

  it('should mount kong.yml as read-only volume', () => {
    const result = generateKongService('net');

    expect(result.gateway.volumes).toEqual(['./kong.yml:/kong/kong.yml:ro']);
  });

  it('should depend on redis', () => {
    const result = generateKongService('net');

    expect(result.gateway.depends_on).toEqual(['redis']);
  });

  it('should include healthcheck', () => {
    const result = generateKongService('net');

    expect(result.gateway.healthcheck).toBeDefined();
    expect(result.gateway.healthcheck!.test).toEqual(['CMD', 'kong', 'health']);
    expect(result.gateway.healthcheck!.retries).toBe(5);
  });
});
