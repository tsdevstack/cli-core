/**
 * Generate Redis service configuration
 */

import type { DockerComposeServices } from '../types';
import { LOCAL_REDIS_MAXMEMORY } from '../../../constants';

export function generateRedisService(
  networkName: string,
): DockerComposeServices {
  return {
    redis: {
      image: 'redis:7-alpine',
      restart: 'always',
      // maxmemory bounds the container so a runaway stream or queue can't eat
      // the host (Docker Desktop degrades badly here). noeviction matches the
      // managed instances on GCP/AWS/Azure, so local hits the same failure
      // mode as production instead of silently dropping keys.
      command:
        'redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}' +
        ` --maxmemory ${LOCAL_REDIS_MAXMEMORY} --maxmemory-policy noeviction`,
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
