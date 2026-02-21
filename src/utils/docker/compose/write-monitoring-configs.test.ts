import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockWriteYamlFile } = rs.hoisted(() => ({
  mockWriteYamlFile: rs.fn(),
}));

rs.mock('fs', { mock: true });
rs.mock('../../fs', () => ({
  writeYamlFile: mockWriteYamlFile,
}));

import * as fs from 'fs';
import { writeMonitoringConfigs } from './write-monitoring-configs';
import type { FrameworkConfig } from '../../config';

function makeConfig(
  services: FrameworkConfig['services'] = [],
): FrameworkConfig {
  return {
    project: { name: 'test-project', version: '1.0.0' },
    cloud: { provider: 'gcp' },
    services,
  };
}

describe('writeMonitoringConfigs', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    rs.mocked(fs.existsSync).mockReturnValue(false);
  });

  describe('Prometheus config', () => {
    it('should create prometheus directory if it does not exist', () => {
      writeMonitoringConfigs('/root', makeConfig());

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('prometheus'),
        { recursive: true },
      );
    });

    it('should write prometheus.yml with default scrape config', () => {
      writeMonitoringConfigs('/root', makeConfig());

      expect(mockWriteYamlFile).toHaveBeenCalledWith(
        expect.stringContaining('prometheus/prometheus.yml'),
        expect.objectContaining({
          global: expect.objectContaining({ scrape_interval: '15s' }),
          scrape_configs: expect.arrayContaining([
            expect.objectContaining({ job_name: 'prometheus' }),
          ]),
        }),
      );
    });

    it('should add nestjs services as scrape targets', () => {
      const config = makeConfig([
        { name: 'auth-service', type: 'nestjs', port: 3001 },
        { name: 'bff-service', type: 'nestjs', port: 3002 },
      ]);

      writeMonitoringConfigs('/root', config);

      expect(mockWriteYamlFile).toHaveBeenCalledWith(
        expect.stringContaining('prometheus.yml'),
        expect.objectContaining({
          scrape_configs: expect.arrayContaining([
            expect.objectContaining({
              job_name: 'auth-service',
              static_configs: [{ targets: ['host.docker.internal:3001'] }],
            }),
            expect.objectContaining({
              job_name: 'bff-service',
              static_configs: [{ targets: ['host.docker.internal:3002'] }],
            }),
          ]),
        }),
      );
    });

    it('should not add non-nestjs services as scrape targets', () => {
      const config = makeConfig([
        { name: 'frontend', type: 'nextjs', port: 3000 },
      ]);

      writeMonitoringConfigs('/root', config);

      const call = mockWriteYamlFile.mock.calls.find(
        (c: unknown[]) =>
          typeof c[0] === 'string' &&
          (c[0] as string).includes('prometheus.yml'),
      );
      expect(call).toBeDefined();
      const promConfig = call![1] as { scrape_configs: { job_name: string }[] };
      const jobNames = promConfig.scrape_configs.map(
        (sc: { job_name: string }) => sc.job_name,
      );

      expect(jobNames).not.toContain('frontend');
    });
  });

  describe('Grafana config', () => {
    it('should create grafana provisioning directories', () => {
      writeMonitoringConfigs('/root', makeConfig());

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('grafana/provisioning/datasources'),
        { recursive: true },
      );
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('grafana/provisioning/dashboards'),
        { recursive: true },
      );
    });

    it('should write prometheus datasource config', () => {
      writeMonitoringConfigs('/root', makeConfig());

      expect(mockWriteYamlFile).toHaveBeenCalledWith(
        expect.stringContaining('datasources/prometheus.yml'),
        expect.objectContaining({
          apiVersion: 1,
          datasources: expect.arrayContaining([
            expect.objectContaining({
              name: 'Prometheus',
              type: 'prometheus',
              url: 'http://prometheus:9090',
            }),
          ]),
        }),
      );
    });

    it('should write services dashboard JSON', () => {
      writeMonitoringConfigs('/root', makeConfig());

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('dashboards/services.json'),
        expect.any(String),
      );
    });

    it('should skip directory creation if directories exist', () => {
      rs.mocked(fs.existsSync).mockReturnValue(true);

      writeMonitoringConfigs('/root', makeConfig());

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });
});
