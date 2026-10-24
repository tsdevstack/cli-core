/**
 * Generate the local object storage services: a RustFS server (S3-compatible)
 * and a one-shot s5cmd container that creates the configured buckets.
 */

import {
  LOCAL_STORAGE_API_PORT,
  LOCAL_STORAGE_CONSOLE_PORT,
  LOCAL_STORAGE_IMAGE,
  LOCAL_STORAGE_INIT_IMAGE,
} from '../../../constants';
import type { FrameworkConfig } from '../../config';
import type { DockerComposeServices } from '../types';

export function generateRustfsService(
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

  // Inside the compose network the server is reachable by its service name
  const endpoint = `http://rustfs:${LOCAL_STORAGE_API_PORT}`;

  // Per bucket: `ls` succeeds when it exists, otherwise `mb` creates it
  const initCommands = bucketNames.map(
    (name) =>
      `(/s5cmd --endpoint-url ${endpoint} ls s3://${name} >/dev/null 2>&1 || /s5cmd --endpoint-url ${endpoint} mb s3://${name})`,
  );
  const entrypoint = ['/bin/sh', '-c', initCommands.join(' && ')];

  return {
    rustfs: {
      image: LOCAL_STORAGE_IMAGE,
      restart: 'always',
      // The image's own user is 10001; root keeps the ./data bind mount
      // writable on every host, as the other data services do
      user: '0:0',
      ports: [
        `${LOCAL_STORAGE_API_PORT}:${LOCAL_STORAGE_API_PORT}`,
        `${LOCAL_STORAGE_CONSOLE_PORT}:${LOCAL_STORAGE_CONSOLE_PORT}`,
      ],
      environment: {
        RUSTFS_ACCESS_KEY: '${STORAGE_ACCESS_KEY}',
        RUSTFS_SECRET_KEY: '${STORAGE_SECRET_KEY}',
        RUSTFS_ADDRESS: `:${LOCAL_STORAGE_API_PORT}`,
        RUSTFS_CONSOLE_ENABLE: 'true',
        RUSTFS_CONSOLE_ADDRESS: `:${LOCAL_STORAGE_CONSOLE_PORT}`,
      },
      volumes: ['./data/rustfs:/data'],
      healthcheck: {
        test: [
          'CMD',
          'curl',
          '-sf',
          `http://localhost:${LOCAL_STORAGE_API_PORT}/health`,
        ],
        interval: '5s',
        timeout: '5s',
        retries: 5,
        start_period: '5s',
      },
      networks: [networkName],
    },
    'rustfs-init': {
      image: LOCAL_STORAGE_INIT_IMAGE,
      depends_on: {
        rustfs: { condition: 'service_healthy' },
      },
      environment: {
        AWS_ACCESS_KEY_ID: '${STORAGE_ACCESS_KEY}',
        AWS_SECRET_ACCESS_KEY: '${STORAGE_SECRET_KEY}',
        AWS_REGION: 'us-east-1',
      },
      entrypoint,
      networks: [networkName],
    },
  };
}
