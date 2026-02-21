/**
 * Generate Grafana service configuration
 */

import type { DockerComposeServices } from '../types';

export function generateGrafanaService(
  networkName: string
): DockerComposeServices {
  return {
    grafana: {
      image: 'grafana/grafana:10.2.0',
      restart: 'always',
      ports: ['4001:3000'],
      environment: [
        'GF_SECURITY_ADMIN_USER=admin',
        'GF_SECURITY_ADMIN_PASSWORD=admin',
        'GF_AUTH_ANONYMOUS_ENABLED=true',
        'GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer',
      ],
      volumes: [
        './grafana/provisioning:/etc/grafana/provisioning:ro',
        './grafana/dashboards:/var/lib/grafana/dashboards:ro',
        './data/grafana:/var/lib/grafana',
      ],
      networks: [networkName],
      depends_on: ['prometheus'],
      healthcheck: {
        test: [
          'CMD-SHELL',
          'wget -q --spider http://localhost:3000/api/health || exit 1',
        ],
        interval: '10s',
        timeout: '5s',
        retries: 3,
      },
    },
  };
}