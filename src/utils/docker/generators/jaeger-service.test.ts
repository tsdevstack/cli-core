import { describe, it, expect } from '@rstest/core';
import { generateJaegerService } from './jaeger-service';

describe('generateJaegerService', () => {
  it('should generate jaeger service config', () => {
    const result = generateJaegerService('test-network');

    expect(result).toHaveProperty('jaeger');
    const service = result.jaeger;
    expect(service.image).toBe('jaegertracing/all-in-one:1.53');
    expect(service.restart).toBe('always');
    expect(service.networks).toEqual(['test-network']);
  });

  it('should expose UI and OTLP ports', () => {
    const result = generateJaegerService('net');

    expect(result.jaeger.ports).toEqual(['16686:16686', '4318:4318']);
  });

  it('should enable OTLP collector', () => {
    const result = generateJaegerService('net');
    const env = result.jaeger.environment as string[];

    expect(env).toContain('COLLECTOR_OTLP_ENABLED=true');
  });

  it('should include healthcheck', () => {
    const result = generateJaegerService('net');

    expect(result.jaeger.healthcheck).toBeDefined();
    expect(result.jaeger.healthcheck!.retries).toBe(3);
  });
});
