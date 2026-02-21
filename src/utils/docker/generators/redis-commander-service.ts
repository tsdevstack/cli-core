/**
 * Generate Redis Commander service configuration
 */

import type { DockerComposeServices } from '../types';

export function generateRedisCommanderService(networkName: string): DockerComposeServices {
  return {
    'redis-commander': {
      image: 'rediscommander/redis-commander:latest',
      platform: 'linux/amd64',
      restart: 'always',
      environment: ['REDIS_HOSTS=local:redis:6379:0:${REDIS_PASSWORD}'],
      ports: ['8081:8081'],
      networks: [networkName],
      depends_on: ['redis'],
      healthcheck: {
        test: ['CMD-SHELL', 'exit 0'],
        interval: '1h',
        timeout: '1s',
        retries: 1,
        start_period: '10s',
      },
    },
  };
}