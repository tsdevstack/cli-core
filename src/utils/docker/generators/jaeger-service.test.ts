import { describe, it, expect } from '@rstest/core';
import { generateJaegerService } from './jaeger-service';

describe('generateJaegerService', () => {
  it('should generate jaeger service config', () => {
    const result = generateJaegerService('test-network');

    expect(result).toHaveProperty('jaeger');
    const service = result.jaeger;
    expect(service.image).toBe('jaegertracing/jaeger:2.22.0');
    expect(service.restart).toBe('always');
    expect(service.networks).toEqual(['test-network']);
  });

  it('should expose UI and OTLP ports', () => {
    const result = generateJaegerService('net');

    expect(result.jaeger.ports).toEqual(['16686:16686', '4318:4318']);
  });

  it('should need no setting for OTLP (on by default in Jaeger 2)', () => {
    const result = generateJaegerService('net');

    expect(result.jaeger.environment).toBeUndefined();
  });

  it("should check Jaeger 2's health endpoint", () => {
    const result = generateJaegerService('net');

    expect(result.jaeger.healthcheck?.test).toEqual([
      'CMD-SHELL',
      'wget -q -O /dev/null http://127.0.0.1:13133/status || exit 1',
    ]);
    expect(result.jaeger.healthcheck!.retries).toBe(3);
  });
});
