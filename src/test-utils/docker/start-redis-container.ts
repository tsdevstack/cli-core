/**
 * Start a throwaway Redis container for Docker-backed tests
 */

import { spawnSync } from 'child_process';
import type { RunningContainer } from './types';
import { getContainerHostPort } from './get-container-host-port';
import { sleep } from './sleep';
import { startAttachedContainer } from './start-attached-container';

export interface StartRedisContainerOptions {
  /** Container name (unique per run) */
  name: string;
  /**
   * Cluster mode: one node that owns every slot. It still rejects
   * multi-key commands whose keys are in different slots (CROSSSLOT).
   */
  cluster?: boolean;
  /** Server password (`--requirepass`). Default: none */
  password?: string;
  /** Extra `docker run` arguments before the image (e.g. --network) */
  dockerArgs?: string[];
  /** Redis image. Default: redis:7-alpine */
  image?: string;
}

export interface StartedRedisContainer {
  /** The attached container (stop it with stopAttachedContainer) */
  container: RunningContainer;
  /** Host port published for 6379 (127.0.0.1) */
  port: number;
}

/**
 * Starts `redis-server` (no persistence) as an attached container with 6379
 * published on an ephemeral 127.0.0.1 port, and waits until it answers PING
 * (and, in cluster mode, until the cluster state is ok).
 *
 * @throws Error when Redis is not ready within 30 seconds
 */
export async function startRedisContainer(
  options: StartRedisContainerOptions,
): Promise<StartedRedisContainer> {
  const { name, cluster = false, password } = options;
  const container = startAttachedContainer(name, [
    ...(options.dockerArgs ?? []),
    '-p',
    '127.0.0.1::6379',
    options.image ?? 'redis:7-alpine',
    'redis-server',
    '--save',
    '',
    '--appendonly',
    'no',
    ...(cluster ? ['--cluster-enabled', 'yes'] : []),
    ...(password ? ['--requirepass', password] : []),
  ]);

  const redisCli = (args: string[]): string => {
    const result = spawnSync(
      'docker',
      [
        'exec',
        ...(password ? ['-e', `REDISCLI_AUTH=${password}`] : []),
        name,
        'redis-cli',
        ...args,
      ],
      { encoding: 'utf-8', timeout: 10_000 },
    );
    return result.status === 0 ? result.stdout.trim() : '';
  };

  const port = Number(await getContainerHostPort(name, 6379, 30_000));
  const deadline = Date.now() + 30_000;

  while (redisCli(['ping']) !== 'PONG') {
    if (Date.now() > deadline) {
      throw new Error(
        `Redis ${name} did not start:\n${container.logs.join('')}`,
      );
    }
    await sleep(200);
  }

  if (cluster) {
    redisCli(['cluster', 'addslotsrange', '0', '16383']);
    while (!redisCli(['cluster', 'info']).includes('cluster_state:ok')) {
      if (Date.now() > deadline) {
        throw new Error(`Redis cluster ${name} did not become ok`);
      }
      await sleep(200);
    }
  }

  return { container, port };
}
