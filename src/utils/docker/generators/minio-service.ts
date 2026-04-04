/**
 * Generate MinIO service configuration for local S3-compatible object storage
 */

import type { FrameworkConfig } from '../../config';
import type { DockerComposeServices } from '../types';

export function generateMinioService(
  config: FrameworkConfig,
  networkName: string,
): DockerComposeServices {
  const buckets = config.storage?.buckets;
  if (!buckets || buckets.length === 0) {
    return {};
  }

  const projectName = config.project.name;

  // Build bucket cloud names: {project}-{bucketName}-dev
  const bucketNames = buckets.map((bucket) => `${projectName}-${bucket}-dev`);

  // mc alias + mc mb for each bucket
  const initCommands = [
    'mc alias set local http://minio:9000 $$STORAGE_ACCESS_KEY $$STORAGE_SECRET_KEY',
    ...bucketNames.map((name) => `mc mb --ignore-existing local/${name}`),
  ];

  // Shell entrypoint using $$ for docker-compose literal $ (YAML double-quote escaping)
  const entrypoint = ['/bin/sh', '-c', initCommands.join(' && ')];

  return {
    minio: {
      image: 'minio/minio',
      restart: 'always',
      command: 'server /data --console-address ":9001"',
      ports: ['9000:9000', '9001:9001'],
      environment: {
        MINIO_ROOT_USER: '${STORAGE_ACCESS_KEY}',
        MINIO_ROOT_PASSWORD: '${STORAGE_SECRET_KEY}',
      },
      volumes: ['./data/minio:/data'],
      healthcheck: {
        test: ['CMD', 'mc', 'ready', 'local'],
        interval: '5s',
        timeout: '5s',
        retries: 5,
        start_period: '5s',
      },
      networks: [networkName],
    },
    'minio-init': {
      image: 'minio/mc',
      depends_on: {
        minio: { condition: 'service_healthy' },
      },
      environment: {
        STORAGE_ACCESS_KEY: '${STORAGE_ACCESS_KEY}',
        STORAGE_SECRET_KEY: '${STORAGE_SECRET_KEY}',
      },
      entrypoint,
      networks: [networkName],
    },
  };
}
