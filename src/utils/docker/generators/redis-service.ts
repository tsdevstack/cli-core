/**
 * Generate Redis service configuration
 */

import type { DockerComposeServices } from '../types';

export function generateRedisService(networkName: string): DockerComposeServices {
  return {
    redis: {
      image: 'redis:7-alpine',
      restart: 'always',
      command: 'redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}',
      volumes: ['./data/redis:/data'],
      ports: ['6379:6379'],
      environment: ['REDIS_PASSWORD=${REDIS_PASSWORD}'],
      networks: [networkName],
    },
  };
}