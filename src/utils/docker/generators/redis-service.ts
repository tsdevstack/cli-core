/**
 * Generate Redis service configuration
 */

import type { DockerComposeServices } from '../types';

export function generateRedisService(
  networkName: string,
): DockerComposeServices {
  return {
    redis: {
      image: 'redis:7-alpine',
      restart: 'always',
      command: 'redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}',
      volumes: ['./data/redis:/data'],
      ports: ['6379:6379'],
      environment: ['REDIS_PASSWORD=${REDIS_PASSWORD}'],
      networks: [networkName],
      // `$$` keeps the password out of the rendered compose YAML — compose
      // escapes `$$` to `$`, the container shell then expands $REDIS_PASSWORD
      // from the container's env. Sync's `--wait` step needs this healthcheck;
      // without it, redis is treated as ready the moment the process starts.
      healthcheck: {
        test: [
          'CMD-SHELL',
          'redis-cli -a $$REDIS_PASSWORD ping | grep -q PONG',
        ],
        interval: '5s',
        timeout: '3s',
        retries: 10,
        start_period: '5s',
      },
    },
  };
}
