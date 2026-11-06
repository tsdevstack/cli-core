/**
 * Generate Jaeger service configuration for distributed tracing
 */

import type { DockerComposeServices } from '../types';

export function generateJaegerService(
  networkName: string,
): DockerComposeServices {
  return {
    jaeger: {
      // Jaeger 2: one binary (all-in-one), OTLP receivers on by default
      image: 'jaegertracing/jaeger:2.22.0',
      restart: 'always',
      ports: [
        '16686:16686', // Jaeger UI
        '4318:4318', // OTLP HTTP receiver
      ],
      networks: [networkName],
      healthcheck: {
        // Jaeger 2's health endpoint
        test: [
          'CMD-SHELL',
          'wget -q -O /dev/null http://127.0.0.1:13133/status || exit 1',
        ],
        interval: '10s',
        timeout: '5s',
        retries: 3,
      },
    },
  };
}
