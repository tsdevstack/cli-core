import { describe, it, expect } from '@rstest/core';
import { generateGrafanaService } from './grafana-service';

describe('generateGrafanaService', () => {
  it('should generate grafana service config', () => {
    const result = generateGrafanaService('test-network');

    expect(result).toHaveProperty('grafana');
    const service = result.grafana;
    expect(service.image).toBe('grafana/grafana:10.2.0');
    expect(service.restart).toBe('always');
    expect(service.networks).toEqual(['test-network']);
  });

  it('should expose port 4001 mapped to internal 3000', () => {
    const result = generateGrafanaService('net');

    expect(result.grafana.ports).toEqual(['4001:3000']);
  });

  it('should set admin credentials and anonymous access', () => {
    const result = generateGrafanaService('net');
    const env = result.grafana.environment as string[];

    expect(env).toContain('GF_SECURITY_ADMIN_USER=admin');
    expect(env).toContain('GF_SECURITY_ADMIN_PASSWORD=admin');
    expect(env).toContain('GF_AUTH_ANONYMOUS_ENABLED=true');
  });

  it('should mount provisioning and dashboard volumes', () => {
    const result = generateGrafanaService('net');

    expect(result.grafana.volumes).toEqual([
      './grafana/provisioning:/etc/grafana/provisioning:ro',
      './grafana/dashboards:/var/lib/grafana/dashboards:ro',
      './data/grafana:/var/lib/grafana',
    ]);
  });

  it('should depend on prometheus', () => {
    const result = generateGrafanaService('net');

    expect(result.grafana.depends_on).toEqual(['prometheus']);
  });

  it('should include healthcheck', () => {
    const result = generateGrafanaService('net');

    expect(result.grafana.healthcheck).toBeDefined();
    expect(result.grafana.healthcheck!.test).toContain('CMD-SHELL');
    expect(result.grafana.healthcheck!.retries).toBe(3);
  });
});
