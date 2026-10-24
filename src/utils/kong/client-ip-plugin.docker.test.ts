/**
 * Docker-backed end-to-end test of the tsdevstack-client-ip Kong plugin in
 * the generated Kong image.
 *
 * The Kong config is generated like generate-kong does: framework services
 * from the offers-service fixture (a public route and a JWT route), the
 * framework global plugins (tsdevstack-client-ip included) and a
 * kong.user.yml with the default plugins, its global rate-limiting lowered
 * to MINUTE_LIMIT. Kong trusts X-Forwarded-For from the Docker network, so
 * each request names its sender (the "frontend server" or a direct client)
 * with X-Forwarded-For. The tests read X-RateLimit-Remaining-Minute to see
 * which bucket a request was counted in.
 *
 * Containers run as attached child processes (`docker run --rm`, no -d) on a
 * dedicated network and are removed in afterAll, together with the image,
 * the network and the temp directory. Skipped with a message when Docker is
 * not available.
 *
 * Every resource is named `tsds-clientip-e2e-<pid>-<random>-*`. A run killed
 * before afterAll leaves them behind; the next run removes them at start
 * (removeStaleDockerResources). To clean up by hand:
 *   docker ps -a --filter name=tsds-clientip-e2e- -q | xargs docker rm -f
 *   docker network ls --filter name=tsds-clientip-e2e- -q | xargs docker network rm
 *   docker images --filter reference='tsds-clientip-e2e-*' -q | xargs docker rmi -f
 */

import { describe, it, expect, beforeAll, afterAll } from '@rstest/core';
import { spawnSync } from 'child_process';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';
import { parseOpenApiSecurity } from '../openapi';
import { generateSecurityBasedServices } from './generate-security-routes';
import { buildFrameworkKongConfig } from './build-framework-kong-config';
import { buildApiKeyDefaultLimits } from './build-api-key-default-limits';
import { getDefaultKongPlugins } from './default-plugins';
import { mergeKongConfigs } from './merge-kong-configs';
import { resolveEnvVars, type JsonValue } from './resolve-env-vars';
import { processCorsOrigins } from './process-cors-origins';
import { writeKongBuildContext } from './write-kong-build-context';
import type { KongTemplate } from './types';
import {
  buildDockerTestPrefix,
  getContainerHostPort,
  isDockerAvailable,
  removeStaleDockerResources,
  runDocker,
  sleep,
  startAttachedContainer,
  startRedisContainer,
  stopAttachedContainer,
  waitForHttpOk,
  type RunningContainer,
} from '../../test-utils/docker';
import {
  KONG_CLIENT_IP_HEADER,
  KONG_FRONTEND_TOKEN_HEADER,
  KONG_UPSTREAM_CLIENT_IP_HEADER,
} from '../../constants';

const FIXTURE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'test-fixtures',
  'kong-e2e',
);
const BUILD_TIMEOUT_MS = 15 * 60 * 1000;
const START_TIMEOUT_MS = 90 * 1000;
const TEST_TIMEOUT_MS = 60 * 1000;

const FRONTEND_TOKEN = 'e2e-frontend-token-0123456789abcdef0123456789abcdef';
const TRUST_TOKEN = 'e2e-trust-token';
const CORS_ORIGIN = 'http://localhost:3000';
const REDIS_PASSWORD = 'e2e-redis-pass';
/** Global rate-limiting minute in the suite's kong.user.yml */
const MINUTE_LIMIT = 3;
const PUBLIC_PATH = '/offers/v1/plans/featured';
const JWT_PATH = '/offers/v2.1/user/active-plan';
const REMAINING = 'x-ratelimit-remaining-minute';

const dockerAvailable = isDockerAvailable();

if (!dockerAvailable) {
  console.log(
    'Skipping client IP plugin Docker tests: Docker is not available (`docker info` failed). Start Docker to run them.',
  );
}

const RESOURCE_BASE = 'tsds-clientip-e2e';
const prefix = buildDockerTestPrefix(RESOURCE_BASE);
const network = `${prefix}-net`;
const image = `${prefix}-kong`;
const echoName = `${prefix}-echo`;
const redisName = `${prefix}-redis`;
const kongName = `${prefix}-kong`;
const echoUrl = `http://${echoName}:3000`;

interface Reply {
  status: number;
  remaining: number | null;
  body: string;
}

/** Generated kong.yml with the framework global plugins */
function generateKongConfig(): KongTemplate {
  const parsed = parseOpenApiSecurity(
    'offers-service',
    path.join(FIXTURE_DIR, 'offers-service.openapi.json'),
  );

  // kong.user.yml: the default plugins with a low global minute limit
  const userConfig: KongTemplate = {
    _format_version: '3.0',
    _transform: true,
    services: [],
    plugins: getDefaultKongPlugins().map((plugin) =>
      plugin.name === 'rate-limiting'
        ? { ...plugin, config: { ...plugin.config, minute: MINUTE_LIMIT } }
        : plugin,
    ),
  };

  const services = generateSecurityBasedServices({
    serviceName: 'offers-service',
    serviceUrl: '${KONG_SERVICE_HOST}',
    globalPrefix: 'offers',
    groupedRoutes: parsed.groupedRoutes,
    partnerApi: {
      defaultLimits: buildApiKeyDefaultLimits(userConfig),
      ipLimitPerMinute: 10_000,
    },
    oidcDiscoveryUrl: '${OIDC_DISCOVERY_URL}',
  });

  const merged = mergeKongConfigs(
    buildFrameworkKongConfig(services),
    userConfig,
  );

  const resolved = resolveEnvVars(merged as unknown as JsonValue, {
    KONG_SERVICE_HOST: echoUrl,
    OIDC_DISCOVERY_URL: `${echoUrl}/.well-known/openid-configuration`,
    KONG_SSL_VERIFY: 'no',
    KONG_TRUST_TOKEN: TRUST_TOKEN,
    KONG_FRONTEND_TOKEN: FRONTEND_TOKEN,
    KONG_CORS_ORIGINS: CORS_ORIGIN,
    REDIS_HOST: redisName,
    REDIS_PORT: '6379',
    REDIS_PASSWORD,
  }) as unknown as KongTemplate;
  processCorsOrigins(resolved);
  return resolved;
}

/** A fresh address, so no two tests share a bucket */
function randomIp(): string {
  const [a, b] = randomBytes(2);
  return `198.18.${a}.${b}`;
}

/**
 * Waits for the next minute when the current one is about to end, so a
 * test's requests are counted in one rate-limit window
 */
async function waitForMinuteHeadroom(): Promise<void> {
  const intoMinute = Date.now() % 60_000;
  if (intoMinute > 50_000) {
    await sleep(60_000 - intoMinute + 200);
  }
}

describe.skipIf(!dockerAvailable)(
  'tsdevstack-client-ip plugin (Docker)',
  () => {
    let tempDir: string | undefined;
    let echo: RunningContainer | undefined;
    let redisContainer: RunningContainer | undefined;
    let kong: RunningContainer | undefined;
    let proxyUrl: string;
    let echoHostUrl: string;

    /** Request from `sender` (X-Forwarded-For) with optional extra headers */
    async function send(
      requestPath: string,
      sender: string,
      headers: Record<string, string> = {},
    ): Promise<Reply> {
      const response = await fetch(`${proxyUrl}${requestPath}`, {
        headers: { 'X-Forwarded-For': sender, ...headers },
      });
      const remaining = response.headers.get(REMAINING);
      return {
        status: response.status,
        remaining: remaining === null ? null : Number(remaining),
        body: await response.text(),
      };
    }

    /** The frontend's headers for a visitor */
    function asFrontend(
      visitor: string,
      token = FRONTEND_TOKEN,
    ): Record<string, string> {
      return {
        [KONG_CLIENT_IP_HEADER]: visitor,
        [KONG_FRONTEND_TOKEN_HEADER]: token,
      };
    }

    async function mintToken(sub: string): Promise<string> {
      const response = await fetch(`${echoHostUrl}/mint?sub=${sub}`);
      return response.text();
    }

    beforeAll(
      async () => {
        removeStaleDockerResources(RESOURCE_BASE);
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clientip-e2e-test-'));

        const contextDir = path.join(tempDir, 'context');
        writeKongBuildContext({
          projectRoot: path.join(tempDir, 'project'),
          contextDir,
          kongYml: yaml.dump(generateKongConfig(), { lineWidth: -1 }),
        });
        runDocker(['build', '-t', image, contextDir], BUILD_TIMEOUT_MS);
        runDocker(['network', 'create', network]);

        echo = startAttachedContainer(echoName, [
          '--network',
          network,
          '-e',
          `ISSUER=${echoUrl}`,
          '-p',
          '127.0.0.1::3000',
          'node:22-alpine',
          'node',
          '-e',
          fs.readFileSync(path.join(FIXTURE_DIR, 'echo-server.cjs'), 'utf-8'),
        ]);
        const started = await startRedisContainer({
          name: redisName,
          password: REDIS_PASSWORD,
          dockerArgs: ['--network', network],
        });
        redisContainer = started.container;

        const echoPort = await getContainerHostPort(echoName, 3000);
        echoHostUrl = `http://127.0.0.1:${echoPort}`;
        await waitForHttpOk(
          `${echoHostUrl}/.well-known/openid-configuration`,
          echo,
        );

        kong = startAttachedContainer(kongName, [
          '--network',
          network,
          '-p',
          '127.0.0.1::8080',
          '-p',
          '127.0.0.1::8100',
          image,
        ]);
        const statusPort = await getContainerHostPort(kongName, 8100);
        const proxyPort = await getContainerHostPort(kongName, 8080);
        proxyUrl = `http://127.0.0.1:${proxyPort}`;
        await waitForHttpOk(
          `http://127.0.0.1:${statusPort}/status/ready`,
          kong,
        );
      },
      BUILD_TIMEOUT_MS + START_TIMEOUT_MS * 3,
    );

    afterAll(async () => {
      await stopAttachedContainer(kongName, kong);
      await stopAttachedContainer(echoName, echo);
      await stopAttachedContainer(redisName, redisContainer);
      spawnSync('docker', ['network', 'rm', network], { stdio: 'ignore' });
      spawnSync('docker', ['rmi', '-f', image], { stdio: 'ignore' });
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }, 120_000);

    describe('public route', () => {
      it(
        'should count a frontend call against the visitor it names, not the frontend',
        async () => {
          await waitForMinuteHeadroom();
          const frontend = randomIp();
          const alice = randomIp();
          const bob = randomIp();

          const first = await send(PUBLIC_PATH, frontend, asFrontend(alice));
          const second = await send(PUBLIC_PATH, frontend, asFrontend(alice));
          const otherVisitor = await send(
            PUBLIC_PATH,
            frontend,
            asFrontend(bob),
          );
          const frontendItself = await send(PUBLIC_PATH, frontend);

          expect(
            [first, second, otherVisitor, frontendItself].map((r) => [
              r.status,
              r.remaining,
            ]),
          ).toEqual([
            [200, MINUTE_LIMIT - 1],
            [200, MINUTE_LIMIT - 2],
            [200, MINUTE_LIMIT - 1],
            [200, MINUTE_LIMIT - 1],
          ]);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should limit each visitor separately behind one frontend',
        async () => {
          await waitForMinuteHeadroom();
          const frontend = randomIp();
          const alice = randomIp();
          const bob = randomIp();

          const statuses: number[] = [];
          for (let i = 0; i <= MINUTE_LIMIT; i++) {
            statuses.push(
              (await send(PUBLIC_PATH, frontend, asFrontend(alice))).status,
            );
          }
          const bobReply = await send(PUBLIC_PATH, frontend, asFrontend(bob));

          expect(statuses).toEqual([200, 200, 200, 429]);
          expect(bobReply.status).toBe(200);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should ignore the visitor address when the token is wrong',
        async () => {
          await waitForMinuteHeadroom();
          const sender = randomIp();

          const first = await send(
            PUBLIC_PATH,
            sender,
            asFrontend(randomIp(), `${FRONTEND_TOKEN}x`),
          );
          const second = await send(
            PUBLIC_PATH,
            sender,
            asFrontend(randomIp(), 'wrong'),
          );
          const withoutToken = await send(PUBLIC_PATH, sender, {
            [KONG_CLIENT_IP_HEADER]: randomIp(),
          });

          // All three counted against the sender's own address
          expect([
            first.remaining,
            second.remaining,
            withoutToken.remaining,
          ]).toEqual([MINUTE_LIMIT - 1, MINUTE_LIMIT - 2, MINUTE_LIMIT - 3]);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should ignore a visitor value that is not an IP address',
        async () => {
          await waitForMinuteHeadroom();
          const frontend = randomIp();

          const first = await send(
            PUBLIC_PATH,
            frontend,
            asFrontend('not-an-ip'),
          );
          const second = await send(
            PUBLIC_PATH,
            frontend,
            asFrontend('1.2.3.4; rm'),
          );
          const plain = await send(PUBLIC_PATH, frontend);

          expect([first.remaining, second.remaining, plain.remaining]).toEqual([
            MINUTE_LIMIT - 1,
            MINUTE_LIMIT - 2,
            MINUTE_LIMIT - 3,
          ]);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should accept an IPv6 visitor address',
        async () => {
          await waitForMinuteHeadroom();
          const frontend = randomIp();
          const visitor = `2001:db8::${randomBytes(2).toString('hex')}`;

          const first = await send(PUBLIC_PATH, frontend, asFrontend(visitor));
          const plain = await send(PUBLIC_PATH, frontend);

          expect([first.remaining, plain.remaining]).toEqual([
            MINUTE_LIMIT - 1,
            MINUTE_LIMIT - 1,
          ]);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should not pass the visitor or token header to the backend',
        async () => {
          await waitForMinuteHeadroom();
          const valid = await send(
            PUBLIC_PATH,
            randomIp(),
            asFrontend(randomIp()),
          );
          const wrong = await send(
            PUBLIC_PATH,
            randomIp(),
            asFrontend(randomIp(), 'wrong'),
          );

          for (const reply of [valid, wrong]) {
            expect(reply.status).toBe(200);
            const received = JSON.parse(reply.body) as {
              headers: Record<string, string | undefined>;
            };
            expect(
              received.headers[KONG_CLIENT_IP_HEADER.toLowerCase()],
            ).toBeUndefined();
            expect(
              received.headers[KONG_FRONTEND_TOKEN_HEADER.toLowerCase()],
            ).toBeUndefined();
          }
        },
        TEST_TIMEOUT_MS,
      );
    });

    describe('backend address (X-Tsdevstack-Real-IP)', () => {
      /** The address the echo upstream (the backend) received */
      function backendIp(reply: Reply): string | undefined {
        const received = JSON.parse(reply.body) as {
          headers: Record<string, string | undefined>;
        };
        return received.headers[KONG_UPSTREAM_CLIENT_IP_HEADER.toLowerCase()];
      }

      it(
        'should send the backend the visitor a trusted frontend named',
        async () => {
          const visitor = randomIp();

          const reply = await send(
            PUBLIC_PATH,
            randomIp(),
            asFrontend(visitor),
          );

          expect(backendIp(reply)).toBe(visitor);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should send the backend the sender address without a valid token',
        async () => {
          const plainSender = randomIp();
          const wrongSender = randomIp();

          const plain = await send(PUBLIC_PATH, plainSender);
          const wrong = await send(
            PUBLIC_PATH,
            wrongSender,
            asFrontend(randomIp(), 'wrong'),
          );

          expect([backendIp(plain), backendIp(wrong)]).toEqual([
            plainSender,
            wrongSender,
          ]);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should replace a value the client sent',
        async () => {
          const sender = randomIp();
          const visitor = randomIp();
          const forged = { [KONG_UPSTREAM_CLIENT_IP_HEADER]: '203.0.113.66' };

          const direct = await send(PUBLIC_PATH, sender, forged);
          const viaFrontend = await send(PUBLIC_PATH, randomIp(), {
            ...forged,
            ...asFrontend(visitor),
          });

          expect([backendIp(direct), backendIp(viaFrontend)]).toEqual([
            sender,
            visitor,
          ]);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should send the visitor on a logged-in request through the frontend',
        async () => {
          const authorization = `Bearer ${await mintToken(`user-${randomBytes(4).toString('hex')}`)}`;
          const visitor = randomIp();

          const reply = await send(JWT_PATH, randomIp(), {
            Authorization: authorization,
            ...asFrontend(visitor),
          });

          expect(reply.status).toBe(200);
          expect(backendIp(reply)).toBe(visitor);
        },
        TEST_TIMEOUT_MS,
      );
    });

    describe('JWT route', () => {
      it(
        'should keep counting a logged-in user per user, whatever visitor the frontend names',
        async () => {
          await waitForMinuteHeadroom();
          const authorization = `Bearer ${await mintToken(`user-${randomBytes(4).toString('hex')}`)}`;
          const frontend = randomIp();

          const viaFrontend = await send(JWT_PATH, frontend, {
            Authorization: authorization,
            ...asFrontend(randomIp()),
          });
          const otherVisitor = await send(JWT_PATH, frontend, {
            Authorization: authorization,
            ...asFrontend(randomIp()),
          });
          const direct = await send(JWT_PATH, randomIp(), {
            Authorization: authorization,
          });

          expect(
            [viaFrontend, otherVisitor, direct].map((r) => [
              r.status,
              r.remaining,
            ]),
          ).toEqual([
            [200, MINUTE_LIMIT - 1],
            [200, MINUTE_LIMIT - 2],
            [200, MINUTE_LIMIT - 3],
          ]);
        },
        TEST_TIMEOUT_MS,
      );
    });
  },
);
