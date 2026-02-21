import { describe, it, expect } from '@rstest/core';
import { generatePrometheusService } from './prometheus-service';

describe('generatePrometheusService', () => {
  it('should generate prometheus service config', () => {
    const result = generatePrometheusService('test-network');

    expect(result).toHaveProperty('prometheus');
    const service = result.prometheus;
    expect(service.image).toBe('prom/prometheus:v2.47.0');
    expect(service.restart).toBe('always');
    expect(service.networks).toEqual(['test-network']);
  });

  it('should expose port 9090', () => {
    const result = generatePrometheusService('net');

    expect(result.prometheus.ports).toEqual(['9090:9090']);
  });

  it('should mount prometheus config and data volumes', () => {
    const result = generatePrometheusService('net');

    expect(result.prometheus.volumes).toEqual([
      './prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro',
      './data/prometheus:/prometheus',
    ]);
  });

  it('should set retention and config command args', () => {
    const result = generatePrometheusService('net');

    expect(result.prometheus.command).toEqual([
      '--config.file=/etc/prometheus/prometheus.yml',
      '--storage.tsdb.retention.time=7d',
    ]);
  });

  it('should include healthcheck', () => {
    const result = generatePrometheusService('net');

    expect(result.prometheus.healthcheck).toBeDefined();
    expect(result.prometheus.healthcheck!.retries).toBe(3);
  });
});
