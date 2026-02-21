/**
 * Generate Prometheus service configuration
 */

import type { DockerComposeServices } from '../types';

export function generatePrometheusService(
  networkName: string
): DockerComposeServices {
  return {
    prometheus: {
      image: 'prom/prometheus:v2.47.0',
      restart: 'always',
      ports: ['9090:9090'],
      volumes: [
        './prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro',
        './data/prometheus:/prometheus',
      ],
      command: [
        '--config.file=/etc/prometheus/prometheus.yml',
        '--storage.tsdb.retention.time=7d',
      ],
      networks: [networkName],
      healthcheck: {
        test: ['CMD', 'wget', '-q', '--spider', 'http://localhost:9090/-/healthy'],
        interval: '10s',
        timeout: '5s',
        retries: 3,
      },
    },
  };
}