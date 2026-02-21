/**
 * Generate Kong Gateway service configuration
 */

import type { DockerComposeServices } from '../types';

export function generateKongService(networkName: string): DockerComposeServices {
  return {
    gateway: {
      build: {
        context: './infrastructure/kong',
        dockerfile: 'Dockerfile',
      },
      image: 'tsdevstack-kong:latest',
      environment: {
        KONG_DATABASE: 'off',
        KONG_DECLARATIVE_CONFIG: '/kong/kong.yml',
        KONG_PROXY_ACCESS_LOG: '/dev/stdout',
        KONG_ADMIN_ACCESS_LOG: '/dev/stdout',
        KONG_PROXY_ERROR_LOG: '/dev/stderr',
        KONG_ADMIN_ERROR_LOG: '/dev/stderr',
        KONG_ADMIN_LISTEN: '0.0.0.0:8001',
        KONG_PROXY_LISTEN: '0.0.0.0:8000',
      },
      volumes: ['./kong.yml:/kong/kong.yml:ro'],
      ports: ['8000:8000', '8001:8001'],
      networks: [networkName],
      depends_on: ['redis'],
      healthcheck: {
        test: ['CMD', 'kong', 'health'],
        interval: '10s',
        timeout: '5s',
        retries: 5,
      },
    },
  };
}