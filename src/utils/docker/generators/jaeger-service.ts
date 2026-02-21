/**
 * Generate Jaeger service configuration for distributed tracing
 */

import type { DockerComposeServices } from '../types';

export function generateJaegerService(
  networkName: string
): DockerComposeServices {
  return {
    jaeger: {
      image: 'jaegertracing/all-in-one:1.53',
      restart: 'always',
      ports: [
        '16686:16686', // Jaeger UI
        '4318:4318', // OTLP HTTP receiver
      ],
      environment: ['COLLECTOR_OTLP_ENABLED=true'],
      networks: [networkName],
      healthcheck: {
        test: ['CMD-SHELL', 'wget -q --spider http://localhost:16686/ || exit 1'],
        interval: '10s',
        timeout: '5s',
        retries: 3,
      },
    },
  };
}