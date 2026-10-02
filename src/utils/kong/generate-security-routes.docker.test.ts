/**
 * Docker-backed end-to-end test of the generated Kong gateway.
 *
 * The Kong config is generated from a fixture OpenAPI document through the
 * same functions generate-kong uses (parseOpenApiSecurity,
 * generateSecurityBasedServices, buildFrameworkKongConfig, the default
 * kong.user.yml plugins, mergeKongConfigs, resolveEnvVars,
 * processCorsOrigins). The image is built from the generated build context
 * (framework plugins staged by writeKongBuildContext) with the config baked
 * in. Kong runs against:
 *
 * - an echo upstream (test-fixtures/kong-e2e/echo-server.cjs) that returns the
 *   request it received and doubles as the mock OIDC issuer (it counts the
 *   discovery and JWKS fetches, to check that Kong caches them)
 * - Redis, for the default rate-limiting plugin, the per-IP ceiling and the
 *   API key records (seeded through the @tsdevstack/nest-common contract)
 *
 * Containers run as attached child processes (`docker run --rm`, no -d) on a
 * dedicated network and are removed in afterAll, together with the image,
 * the network and the temp directory. Skipped with a message when Docker is
 * not available.
 *
 * Every resource is named `tsds-kong-e2e-<random>-*`. If a run is killed
 * before afterAll, clean up with:
 *   docker ps -a --filter name=tsds-kong-e2e- -q | xargs docker rm -f
 *   docker network ls --filter name=tsds-kong-e2e- -q | xargs docker network rm
 *   docker images --filter reference='tsds-kong-e2e-*' -q | xargs docker rmi -f
 */

import { describe, it, expect, beforeAll, afterAll } from '@rstest/core';
import { spawnSync } from 'child_process';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';
import Redis from 'ioredis';
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
  getContainerHostPort,
  isDockerAvailable,
  runDocker,
  sleep,
  startAttachedContainer,
  startRedisContainer,
  stopAttachedContainer,
  waitForHttpOk,
  type RunningContainer,
} from '../../test-utils/docker';
import { loadApiKeyContract } from '../../test-utils/kong';

const {
  API_KEY_INDEX_MARKER_KEY,
  buildApiKeyRecordKey,
  encodeApiKeyRecord,
  hashApiKey,
} = loadApiKeyContract();

const FIXTURE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'test-fixtures',
  'kong-e2e',
);
const BUILD_TIMEOUT_MS = 15 * 60 * 1000;
const START_TIMEOUT_MS = 90 * 1000;
const TEST_TIMEOUT_MS = 30 * 1000;

const TRUST_TOKEN = 'e2e-trust-token';
const PARTNER_KEY = `tsk_${randomBytes(32).toString('base64url')}`;
const PARTNER_KEY_ID = 'e2e-key-id';
const PARTNER_CONSUMER = 'partner-acme';
/** framework.apiKeys.ipLimitPerMinute: low, so one test can exceed it */
const IP_LIMIT_PER_MINUTE = 5;
/**
 * Global rate-limiting of the suite's kong.user.yml: an hour limit only, so
 * keys get no default minute limit and the key plugin sets no minute headers
 * (any minute header on a partner response would be the ceiling's).
 */
const GLOBAL_HOUR_LIMIT = 1000;
/** Headers the per-IP ceiling sets (minute window) */
const CEILING_HEADERS = [
  'x-ratelimit-limit-minute',
  'x-ratelimit-remaining-minute',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'retry-after',
];
const CORS_ORIGIN = 'http://localhost:3000';
const REDIS_PASSWORD = 'e2e-redis-pass';

const dockerAvailable = isDockerAvailable();

if (!dockerAvailable) {
  console.log(
    'Skipping Kong end-to-end Docker tests: Docker is not available (`docker info` failed). Start Docker to run them.',
  );
}

const runId = randomBytes(4).toString('hex');
const prefix = `tsds-kong-e2e-${runId}`;
const network = `${prefix}-net`;
const image = `${prefix}-kong`;
const echoName = `${prefix}-echo`;
const redisName = `${prefix}-redis`;
const kongName = `${prefix}-kong`;
const echoUrl = `http://${echoName}:3000`;

/** What the echo upstream received */
interface Echo {
  method: string;
  url: string;
  headers: Record<string, string | undefined>;
}

/**
 * Generates the resolved kong.yml the way generate-kong does, with the
 * fixture OpenAPI document for offers-service.
 */
function generateKongConfig(): KongTemplate {
  const parsed = parseOpenApiSecurity(
    'offers-service',
    path.join(FIXTURE_DIR, 'offers-service.openapi.json'),
  );

  const userConfig: KongTemplate = {
    _format_version: '3.0',
    _transform: true,
    services: [],
    plugins: getDefaultKongPlugins().map((plugin) => {
      if (plugin.name !== 'rate-limiting') return plugin;
      const config = Object.fromEntries(
        Object.entries(plugin.config).filter(([name]) => name !== 'minute'),
      );
      return { ...plugin, config: { ...config, hour: GLOBAL_HOUR_LIMIT } };
    }),
  };

  const services = generateSecurityBasedServices({
    serviceName: 'offers-service',
    serviceUrl: '${KONG_SERVICE_HOST}',
    globalPrefix: 'offers',
    groupedRoutes: parsed.groupedRoutes,
    partnerApi: {
      defaultLimits: buildApiKeyDefaultLimits(userConfig),
      ipLimitPerMinute: IP_LIMIT_PER_MINUTE,
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
    KONG_CORS_ORIGINS: CORS_ORIGIN,
    REDIS_HOST: redisName,
    REDIS_PORT: '6379',
    REDIS_PASSWORD,
  }) as unknown as KongTemplate;
  processCorsOrigins(resolved);

  return resolved;
}

/**
 * A random client address (Kong trusts X-Forwarded-For from the Docker
 * network), so the per-IP limits only trip where a test wants them to.
 */
function randomClientIp(): string {
  const [a, b] = randomBytes(2);
  return `198.18.${a}.${b}`;
}

/** The per-IP ceiling's headers present on a response */
function ceilingHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(
    CEILING_HEADERS.flatMap((name) => {
      const value = headers.get(name);
      return value === null ? [] : [[name, value]];
    }),
  );
}

describe.skipIf(!dockerAvailable)('Generated Kong gateway (Docker)', () => {
  let tempDir: string | undefined;
  let kongConfig: KongTemplate;
  let echo: RunningContainer | undefined;
  let redis: RunningContainer | undefined;
  let redisClient: Redis | undefined;
  let kong: RunningContainer | undefined;
  let proxyUrl: string;
  let echoHostUrl: string;

  async function send(
    method: string,
    requestPath: string,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; headers: Headers; body: string }> {
    const response = await fetch(`${proxyUrl}${requestPath}`, {
      method,
      headers: { 'X-Forwarded-For': randomClientIp(), ...headers },
    });
    return {
      status: response.status,
      headers: response.headers,
      body: await response.text(),
    };
  }

  /**
   * Sends the path exactly as given (fetch would resolve dot segments and
   * reject some header names before the request leaves the test).
   */
  function sendRaw(
    method: string,
    rawPath: string,
    headers: Record<string, string> = {},
  ): Promise<{ status: number; body: string }> {
    const url = new URL(proxyUrl);
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: url.hostname,
          port: url.port,
          method,
          path: rawPath,
          headers: { 'X-Forwarded-For': randomClientIp(), ...headers },
        },
        (res) => {
          let body = '';
          res.setEncoding('utf-8');
          res.on('data', (chunk: string) => (body += chunk));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
        },
      );
      req.on('error', reject);
      req.end();
    });
  }

  async function upstream(
    method: string,
    requestPath: string,
    headers: Record<string, string> = {},
  ): Promise<Echo> {
    const response = await send(method, requestPath, headers);
    if (response.status !== 200) {
      throw new Error(
        `${method} ${requestPath}: expected 200, got ${response.status}: ${response.body}`,
      );
    }
    return JSON.parse(response.body) as Echo;
  }

  async function expectNoRoute(
    method: string,
    requestPath: string,
    headers: Record<string, string> = {},
  ): Promise<void> {
    const response = await send(method, requestPath, headers);
    expect(response.status).toBe(404);
    expect(response.body).toContain('no Route matched');
  }

  async function mintToken(sub: string): Promise<string> {
    const response = await fetch(
      `${echoHostUrl}/mint?sub=${sub}&preferred_username=alice`,
    );
    return response.text();
  }

  const forgedIdentity: Record<string, string> = {
    'X-Userinfo': Buffer.from(
      JSON.stringify({ sub: 'forged-admin', role: 'ADMIN' }),
    ).toString('base64'),
    'X-Consumer-Username': 'forged-consumer',
    'X-Consumer-ID': 'forged-consumer-id',
    'X-Credential-Identifier': 'forged-credential',
    'X-Anonymous-Consumer': 'forged',
    'X-Api-Key-Id': 'forged-key-id',
    'X-Api-Key-Consumer': 'forged-key-consumer',
    'X-Authenticated-UserId': 'forged-user',
    'X-Kong-Trust': 'forged-trust',
  };

  beforeAll(
    async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kong-e2e-test-'));
      kongConfig = generateKongConfig();

      const contextDir = path.join(tempDir, 'context');
      writeKongBuildContext({
        projectRoot: path.join(tempDir, 'project'),
        contextDir,
        kongYml: yaml.dump(kongConfig, { lineWidth: -1 }),
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
      const startedRedis = await startRedisContainer({
        name: redisName,
        password: REDIS_PASSWORD,
        dockerArgs: ['--network', network],
      });
      redis = startedRedis.container;
      redisClient = new Redis({
        host: '127.0.0.1',
        port: startedRedis.port,
        password: REDIS_PASSWORD,
        maxRetriesPerRequest: 1,
      });
      // Index marker and the partner's key record, as the auth-service writes them
      await redisClient.set(API_KEY_INDEX_MARKER_KEY, '{"v":1,"rebuiltAt":0}');
      await redisClient.set(
        buildApiKeyRecordKey(hashApiKey(PARTNER_KEY)),
        encodeApiKeyRecord({
          v: 1,
          id: PARTNER_KEY_ID,
          consumer: PARTNER_CONSUMER,
          status: 'active',
          limits: {},
        }),
      );

      const echoPort = await getContainerHostPort(echoName, 3000);
      echoHostUrl = `http://127.0.0.1:${echoPort}`;
      // Not an OIDC path: /oidc-hits counts only Kong's fetches
      await waitForHttpOk(`${echoHostUrl}/ready`, echo);

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
      await waitForHttpOk(`http://127.0.0.1:${statusPort}/status/ready`, kong);
    },
    BUILD_TIMEOUT_MS + START_TIMEOUT_MS * 3,
  );

  afterAll(async () => {
    redisClient?.disconnect();
    await stopAttachedContainer(kongName, kong);
    await stopAttachedContainer(echoName, echo);
    await stopAttachedContainer(redisName, redis);
    spawnSync('docker', ['network', 'rm', network], { stdio: 'ignore' });
    spawnSync('docker', ['rmi', '-f', image], { stdio: 'ignore' });
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }, 120_000);

  describe('generated config', () => {
    it('should have no route- or service-level request-transformer or pre-function', () => {
      const perService = JSON.stringify(kongConfig.services);

      expect(perService).not.toContain('request-transformer');
      expect(perService).not.toContain('pre-function');
      expect(kongConfig.plugins![0].name).toBe('tsdevstack-strip-identity');
    });
  });

  describe('partner routes', () => {
    it(
      'should strip client-sent identity headers and pass the key plugin identity, not the raw key',
      async () => {
        const received = await upstream('GET', '/api/offers/v1/plans', {
          'x-api-key': PARTNER_KEY,
          ...forgedIdentity,
        });

        expect(received.url).toBe('/offers/v1/plans');
        expect(received.headers['x-userinfo']).toBeUndefined();
        expect(received.headers['x-authenticated-userid']).toBeUndefined();
        expect(received.headers['x-anonymous-consumer']).toBeUndefined();
        // Set by the key plugin after the strip: @Partner() gets the consumer
        expect(received.headers['x-api-key-id']).toBe(PARTNER_KEY_ID);
        expect(received.headers['x-api-key-consumer']).toBe(PARTNER_CONSUMER);
        // No Kong consumer headers (static keys and key-auth are gone)
        expect(received.headers['x-consumer-username']).toBeUndefined();
        expect(received.headers['x-consumer-id']).toBeUndefined();
        expect(received.headers['x-credential-identifier']).toBeUndefined();
        // The backend never sees the raw key
        expect(received.headers['x-api-key']).toBeUndefined();
        // Client value replaced by the gateway's trust token
        expect(received.headers['x-kong-trust']).toBe(TRUST_TOKEN);
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should route the parameter route and remove only /api (query and encoding kept)',
      async () => {
        const received = await upstream(
          'GET',
          '/api/offers/v1/plans/plan-123?page=2',
          { 'x-api-key': PARTNER_KEY },
        );
        expect(received.url).toBe('/offers/v1/plans/plan-123?page=2');

        const encoded = await upstream('GET', '/api/offers/v1/plans/a%2Fb', {
          'x-api-key': PARTNER_KEY,
        });
        expect(encoded.url).toBe('/offers/v1/plans/a%2Fb');
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should return 404 for a JWT-only path under /api with a valid partner key',
      async () => {
        await expectNoRoute('POST', '/api/offers/v1/user/assign-plan', {
          'x-api-key': PARTNER_KEY,
        });
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should return 404 for a wrong method and extra segments',
      async () => {
        await expectNoRoute('POST', '/api/offers/v1/plans', {
          'x-api-key': PARTNER_KEY,
        });
        await expectNoRoute('GET', '/api/offers/v1/plans/x/extra', {
          'x-api-key': PARTNER_KEY,
        });
        await expectNoRoute('GET', '/api/offers', {
          'x-api-key': PARTNER_KEY,
        });
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should reject a missing or wrong key with 401',
      async () => {
        const missing = await send('GET', '/api/offers/v1/plans');
        expect(missing.status).toBe(401);
        expect(JSON.parse(missing.body)).toMatchObject({
          error: 'api_key_missing',
        });
        const wrong = await send('GET', '/api/offers/v1/plans', {
          'x-api-key': 'nope',
        });
        expect(wrong.status).toBe(401);
        expect(JSON.parse(wrong.body)).toMatchObject({
          error: 'invalid_api_key',
        });
        // The key plugin clears the per-IP ceiling's headers on its denials
        expect(ceilingHeaders(missing.headers)).toEqual({});
        expect(ceilingHeaders(wrong.headers)).toEqual({});
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should stop one IP at the per-IP ceiling, counting invalid keys too',
      async () => {
        // All requests in one minute window (Redis TIME: the Docker VM clock)
        for (;;) {
          const [seconds] = await redisClient!.time();
          if (Number(seconds) % 60 < 45) break;
          await sleep(1000);
        }
        const ip = randomClientIp();
        for (let i = 0; i < IP_LIMIT_PER_MINUTE; i++) {
          const reply = await send('GET', '/api/offers/v1/plans', {
            'X-Forwarded-For': ip,
            'x-api-key': `tsk_guess_${i}`,
          });
          expect(reply.status).toBe(401);
        }

        // The next request from that IP is stopped before the key check,
        // even with a valid key (Kong's rate-limiting answer)
        const blocked = await send('GET', '/api/offers/v1/plans', {
          'X-Forwarded-For': ip,
          'x-api-key': PARTNER_KEY,
        });
        expect(blocked.status).toBe(429);
        expect(JSON.parse(blocked.body)).toMatchObject({
          message: 'API rate limit exceeded',
        });
        // The ceiling's own 429 keeps its headers (the key plugin never ran)
        expect(blocked.headers.get('x-ratelimit-limit-minute')).toBe(
          String(IP_LIMIT_PER_MINUTE),
        );
        expect(blocked.headers.get('x-ratelimit-remaining-minute')).toBe('0');
        expect(blocked.headers.get('ratelimit-limit')).toBe(
          String(IP_LIMIT_PER_MINUTE),
        );
        expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);

        // Other IPs are unaffected
        const admitted = await send('GET', '/api/offers/v1/plans', {
          'x-api-key': PARTNER_KEY,
        });
        expect(admitted.status).toBe(200);
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should show only the key headers on 200 for a key without a minute limit',
      async () => {
        const admitted = await send('GET', '/api/offers/v1/plans', {
          'x-api-key': PARTNER_KEY,
        });
        expect(admitted.status).toBe(200);
        // Key limits: the global hour default only; no ceiling minute headers
        expect(admitted.headers.get('x-ratelimit-limit-minute')).toBeNull();
        expect(admitted.headers.get('x-ratelimit-remaining-minute')).toBeNull();
        expect(admitted.headers.get('retry-after')).toBeNull();
        expect(admitted.headers.get('x-ratelimit-limit-hour')).toBe(
          String(GLOBAL_HOUR_LIMIT),
        );
        expect(admitted.headers.get('ratelimit-limit')).toBe(
          String(GLOBAL_HOUR_LIMIT),
        );
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should clear the ceiling headers on the key plugin 503',
      async () => {
        await redisClient!.del(API_KEY_INDEX_MARKER_KEY);
        try {
          const reply = await send('GET', '/api/offers/v1/plans', {
            'x-api-key': 'tsk_unknown',
          });
          expect(reply.status).toBe(503);
          expect(JSON.parse(reply.body)).toMatchObject({
            error: 'index_unavailable',
          });
          // Only the key plugin's own Retry-After
          expect(ceilingHeaders(reply.headers)).toEqual({ 'retry-after': '5' });
        } finally {
          await redisClient!.set(
            API_KEY_INDEX_MARKER_KEY,
            '{"v":1,"rebuiltAt":0}',
          );
        }
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe('JWT routes', () => {
    it(
      'should pass the OIDC-set X-Userinfo, not the client-sent one',
      async () => {
        const token = await mintToken('user-42');
        const received = await upstream('POST', '/offers/v1/user/assign-plan', {
          Authorization: `Bearer ${token}`,
          ...forgedIdentity,
        });

        const userinfo = JSON.parse(
          Buffer.from(received.headers['x-userinfo'] ?? '', 'base64').toString(
            'utf-8',
          ),
        ) as { sub?: string };
        expect(userinfo.sub).toBe('user-42');
        expect(received.headers['x-consumer-username']).toBeUndefined();
        expect(received.headers['x-api-key-id']).toBeUndefined();
        expect(received.headers['x-kong-trust']).toBe(TRUST_TOKEN);
        expect(received.url).toBe('/offers/v1/user/assign-plan');
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should fetch the discovery document and the JWKS once (lua-resty-openidc caches)',
      async () => {
        // Two different tokens, so a cached verification result cannot
        // stand in for the key lookup on the second request
        for (const sub of ['cache-user-1', 'cache-user-2']) {
          const token = await mintToken(sub);
          const received = await upstream(
            'POST',
            '/offers/v1/user/assign-plan',
            { Authorization: `Bearer ${token}` },
          );
          const userinfo = JSON.parse(
            Buffer.from(
              received.headers['x-userinfo'] ?? '',
              'base64',
            ).toString('utf-8'),
          ) as { sub?: string };
          expect(userinfo.sub).toBe(sub);
        }

        // Counted since the stub started, across every JWT request of the
        // suite: without the shared dicts Kong fetches both on each request
        const hits = (await (
          await fetch(`${echoHostUrl}/oidc-hits`)
        ).json()) as { discovery: number; jwks: number };
        expect(hits).toEqual({ discovery: 1, jwks: 1 });
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should reject a forged X-Userinfo without a token with 401',
      async () => {
        const response = await send('POST', '/offers/v1/user/assign-plan', {
          'X-Userinfo': forgedIdentity['X-Userinfo'],
        });
        expect(response.status).toBe(401);
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should route the parameter route with a token',
      async () => {
        const token = await mintToken('user-42');
        const received = await upstream('GET', '/offers/v1/plans/plan-123', {
          Authorization: `Bearer ${token}`,
        });
        expect(received.url).toBe('/offers/v1/plans/plan-123');
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should return 404 for undeclared paths and methods',
      async () => {
        await expectNoRoute('GET', '/offers/v1/plans/anything/extra');
        await expectNoRoute('GET', '/offers/v1/user/assign-plan');
        await expectNoRoute('GET', '/offers/v1/plansX');
        await expectNoRoute('GET', '/offers/v1/plans/');
        // "." in v2.1 is escaped
        await expectNoRoute('GET', '/offers/v2X1/user/active-plan');
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe('public routes', () => {
    it(
      'should strip forged identity headers and let a literal route win over a parameter route',
      async () => {
        const received = await upstream(
          'GET',
          '/offers/v1/plans/featured',
          forgedIdentity,
        );

        expect(received.url).toBe('/offers/v1/plans/featured');
        expect(received.headers['x-userinfo']).toBeUndefined();
        expect(received.headers['x-consumer-username']).toBeUndefined();
        expect(received.headers['x-credential-identifier']).toBeUndefined();
        expect(received.headers['x-kong-trust']).toBe(TRUST_TOKEN);

        // Only declared methods are routed: HEAD on a GET route is 404
        expect((await send('HEAD', '/offers/v1/plans/featured')).status).toBe(
          404,
        );

        // The {id} route is JWT-protected: without a token Kong answers 401
        expect((await send('GET', '/offers/v1/plans/other')).status).toBe(401);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe('path normalization and header edge cases', () => {
    it(
      'should not reach a JWT-only path through dot segments under /api',
      async () => {
        const response = await sendRaw(
          'POST',
          '/api/offers/v1/plans/x/../../user/assign-plan',
          { 'x-api-key': PARTNER_KEY },
        );
        expect(response.status).toBe(404);
        expect(response.body).toContain('no Route matched');
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should route dot segments that resolve to a partner route and forward the normalized path',
      async () => {
        const response = await sendRaw(
          'GET',
          '/api/offers/v1/user/../plans/123',
          { 'x-api-key': PARTNER_KEY },
        );
        expect(response.status).toBe(200);
        expect((JSON.parse(response.body) as Echo).url).toBe(
          '/offers/v1/plans/123',
        );
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should merge a leading double slash before routing and prefix removal',
      async () => {
        const response = await sendRaw('GET', '//api/offers/v1/plans', {
          'x-api-key': PARTNER_KEY,
        });
        expect(response.status).toBe(200);
        expect((JSON.parse(response.body) as Echo).url).toBe(
          '/offers/v1/plans',
        );
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should authenticate a non-preflight OPTIONS request (401 without key or token)',
      async () => {
        expect((await sendRaw('OPTIONS', '/api/offers/v1/plans')).status).toBe(
          401,
        );
        expect(
          (await sendRaw('OPTIONS', '/offers/v1/user/assign-plan')).status,
        ).toBe(401);
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should drop client-sent identity headers spelled with underscores',
      async () => {
        const response = await sendRaw('GET', '/api/offers/v1/plans', {
          'x-api-key': PARTNER_KEY,
          X_Userinfo: forgedIdentity['X-Userinfo'],
          x_kong_trust: 'forged-trust',
          X_API_KEY_ID: 'forged-key-id',
          'X-Custom_Header': 'kept',
        });
        expect(response.status).toBe(200);
        const received = JSON.parse(response.body) as Echo;
        // Kong's nginx template sets `underscores_in_headers on`, so without
        // the strip plugin these would reach the backend as x_userinfo etc.
        expect(received.headers['x-userinfo']).toBeUndefined();
        expect(received.headers['x_userinfo']).toBeUndefined();
        expect(received.headers['x_kong_trust']).toBeUndefined();
        expect(received.headers['x_api_key_id']).toBeUndefined();
        expect(received.headers['x-kong-trust']).toBe(TRUST_TOKEN);
        // Other underscore headers are untouched
        expect(received.headers['x-custom_header']).toBe('kept');
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should replace a client-sent X-Real-IP with the address Kong resolved',
      async () => {
        const received = await upstream('GET', '/api/offers/v1/plans', {
          'x-api-key': PARTNER_KEY,
          'X-Real-IP': '198.51.100.99',
        });
        expect(received.headers['x-real-ip']).toBeDefined();
        expect(received.headers['x-real-ip']).not.toBe('198.51.100.99');
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe('CORS preflight', () => {
    it(
      'should answer preflights on JWT and partner routes before authentication',
      async () => {
        for (const requestPath of [
          '/offers/v1/user/assign-plan',
          '/api/offers/v1/plans/plan-123',
        ]) {
          const response = await send('OPTIONS', requestPath, {
            Origin: CORS_ORIGIN,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'authorization,x-api-key',
          });

          expect(response.status).toBe(200);
          expect(response.headers.get('access-control-allow-origin')).toBe(
            CORS_ORIGIN,
          );
        }
      },
      TEST_TIMEOUT_MS,
    );
  });
});
