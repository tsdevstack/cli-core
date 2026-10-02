/**
 * Docker-backed test: the generated Kong build context builds an image that
 * runs in both modes and loads a project plugin from kong-plugins/.
 *
 * - Local mode: config mounted, proxy and Admin API set through environment
 *   variables (as docker-compose does). Asserts the plugin is enabled via the
 *   Admin API and marks a proxied request.
 * - Cloud mode: no overrides, config baked into declarative/. Asserts the
 *   plugin marks a proxied request and the Admin API is off.
 *
 * Containers run as attached child processes (`docker run --rm`, no -d) and
 * are removed in afterAll, together with the images and temp directories.
 * Skipped with a message when Docker is not available.
 *
 * Every container and image is named `tsds-kong-image-test-<random>-*`. If a
 * run is killed before afterAll, clean up with:
 *   docker ps -a --filter name=tsds-kong-image-test- -q | xargs docker rm -f
 *   docker images --filter reference='tsds-kong-image-test-*' -q | xargs docker rmi -f
 */

import { describe, it, expect, beforeAll, afterAll } from '@rstest/core';
import { spawnSync } from 'child_process';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { writeKongBuildContext } from './write-kong-build-context';
import {
  getContainerHostPort,
  isDockerAvailable,
  runDocker,
  startAttachedContainer,
  stopAttachedContainer,
  waitForHttpOk,
  type RunningContainer,
} from '../../test-utils/docker';

const FIXTURE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'test-fixtures',
  'kong-image',
);
const FIXTURE_PLUGIN = 'fixture-marker';
const BUILD_TIMEOUT_MS = 15 * 60 * 1000;
const START_TIMEOUT_MS = 90 * 1000;

const dockerAvailable = isDockerAvailable();

if (!dockerAvailable) {
  console.log(
    'Skipping Kong image Docker tests: Docker is not available (`docker info` failed). Start Docker to run them.',
  );
}

const runId = randomBytes(4).toString('hex');
const resourcePrefix = `tsds-kong-image-test-${runId}`;
const localImage = `${resourcePrefix}-local`;
const cloudImage = `${resourcePrefix}-cloud`;
const localContainer = `${resourcePrefix}-local`;
const cloudContainer = `${resourcePrefix}-cloud`;

describe.skipIf(!dockerAvailable)('Kong image (Docker)', () => {
  let tempDir: string;
  let local: RunningContainer | undefined;
  let cloud: RunningContainer | undefined;
  let kongPlugins: string[];

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kong-image-test-'));
    const projectRoot = path.join(tempDir, 'project');
    fs.cpSync(
      path.join(FIXTURE_DIR, 'kong-plugins'),
      path.join(projectRoot, 'kong-plugins'),
      { recursive: true },
    );

    const localContext = path.join(tempDir, 'local-context');
    const cloudContext = path.join(tempDir, 'cloud-context');

    kongPlugins = writeKongBuildContext({
      projectRoot,
      contextDir: localContext,
    });
    writeKongBuildContext({
      projectRoot,
      contextDir: cloudContext,
      kongYml: fs.readFileSync(path.join(FIXTURE_DIR, 'kong.yml'), 'utf-8'),
    });

    // Same Dockerfile, so the second build reuses every layer up to declarative/
    runDocker(['build', '-t', localImage, localContext], BUILD_TIMEOUT_MS);
    runDocker(['build', '-t', cloudImage, cloudContext], BUILD_TIMEOUT_MS);
  }, BUILD_TIMEOUT_MS * 2);

  afterAll(async () => {
    await stopAttachedContainer(localContainer, local);
    await stopAttachedContainer(cloudContainer, cloud);
    spawnSync('docker', ['rmi', '-f', localImage, cloudImage], {
      stdio: 'ignore',
    });
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }, 120_000);

  it('should list the fixture plugin in KONG_PLUGINS', () => {
    expect(kongPlugins).toContain(FIXTURE_PLUGIN);
    expect(kongPlugins.slice(0, 2)).toEqual(['bundled', 'oidc']);
  });

  it(
    'local mode: env overrides and mounted config; plugin enabled via the Admin API',
    async () => {
      local = startAttachedContainer(localContainer, [
        '-e',
        'KONG_PROXY_LISTEN=0.0.0.0:8000',
        '-e',
        'KONG_ADMIN_LISTEN=0.0.0.0:8001',
        '-e',
        'KONG_DECLARATIVE_CONFIG=/kong/kong.yml',
        '-v',
        `${path.join(FIXTURE_DIR, 'kong.yml')}:/kong/kong.yml:ro`,
        '-p',
        '127.0.0.1::8000',
        '-p',
        '127.0.0.1::8001',
        localImage,
      ]);

      const adminPort = await getContainerHostPort(localContainer, 8001);
      const proxyPort = await getContainerHostPort(localContainer, 8000);
      await waitForHttpOk(`http://127.0.0.1:${adminPort}/status`, local);

      const enabled = (await (
        await fetch(`http://127.0.0.1:${adminPort}/plugins/enabled`)
      ).json()) as { enabled_plugins: string[] };
      expect(enabled.enabled_plugins).toContain(FIXTURE_PLUGIN);
      expect(enabled.enabled_plugins).toContain('oidc');
      expect(enabled.enabled_plugins).toContain('key-auth');

      const response = await fetch(`http://127.0.0.1:${proxyPort}/fixture`);
      expect(response.status).toBe(200);
      expect(response.headers.get('x-fixture-marker')).toBe('loaded');
    },
    START_TIMEOUT_MS * 3,
  );

  it(
    'cloud mode: image defaults and baked config; plugin marks the request, Admin API off',
    async () => {
      cloud = startAttachedContainer(cloudContainer, [
        '-p',
        '127.0.0.1::8080',
        '-p',
        '127.0.0.1::8100',
        '-p',
        '127.0.0.1::8001',
        cloudImage,
      ]);

      const statusPort = await getContainerHostPort(cloudContainer, 8100);
      const proxyPort = await getContainerHostPort(cloudContainer, 8080);
      const adminPort = await getContainerHostPort(cloudContainer, 8001);
      await waitForHttpOk(`http://127.0.0.1:${statusPort}/status/ready`, cloud);

      const response = await fetch(`http://127.0.0.1:${proxyPort}/fixture`);
      expect(response.status).toBe(200);
      expect(response.headers.get('x-fixture-marker')).toBe('loaded');

      const health = spawnSync(
        'docker',
        ['exec', cloudContainer, '/usr/local/bin/kong-health-check.sh'],
        { encoding: 'utf-8' },
      );
      expect(health.status).toBe(0);

      // Admin API off: the image default is `off` and nothing listens on 8001
      expect(
        runDocker(['exec', cloudContainer, 'printenv', 'KONG_ADMIN_LISTEN']),
      ).toBe('off');
      const adminInside = spawnSync(
        'docker',
        [
          'exec',
          cloudContainer,
          'curl',
          '-sS',
          '-o',
          '/dev/null',
          'http://127.0.0.1:8001/status',
        ],
        { encoding: 'utf-8' },
      );
      // curl exit code 7: failed to connect (connection refused)
      expect(adminInside.status).toBe(7);
      await expect(
        fetch(`http://127.0.0.1:${adminPort}/status`),
      ).rejects.toThrow();
    },
    START_TIMEOUT_MS * 3,
  );
});
