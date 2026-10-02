/**
 * Docker-backed end-to-end test of the tsdevstack-api-key Kong plugin in the
 * generated Kong image.
 *
 * The Kong config is generated like generate-kong does (same fixture and
 * functions as generate-security-routes.docker.test.ts): the partner service
 * gets tsdevstack-api-key and the per-IP ceiling from the generator, with the
 * default limits derived from a kong.user.yml whose global rate-limiting
 * allows DEFAULT_MINUTE_LIMIT requests per minute. The suite changes one
 * thing: it adds a second key header name, to cover the plugin's handling of
 * several `key_names` (the generator configures `x-api-key` only).
 * Key records are seeded into Redis through the TypeScript contract in
 * @tsdevstack/nest-common, so the Lua key names and record reading are
 * checked against the contract the auth-service writes with.
 *
 * Containers run as attached child processes (`docker run --rm`, no -d) on a
 * dedicated network and are removed in afterAll, together with the image,
 * the network and the temp directory. Skipped with a message when Docker is
 * not available.
 *
 * Every resource is named `tsds-apikey-e2e-<random>-*`. If a run is killed
 * before afterAll, clean up with:
 *   docker ps -a --filter name=tsds-apikey-e2e- -q | xargs docker rm -f
 *   docker network ls --filter name=tsds-apikey-e2e- -q | xargs docker network rm
 *   docker images --filter reference='tsds-apikey-e2e-*' -q | xargs docker rmi -f
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
import type { ApiKeyRecord } from '@tsdevstack/nest-common';
import { parseOpenApiSecurity } from '../openapi';
import { generateSecurityBasedServices } from './generate-security-routes';
import { buildFrameworkKongConfig } from './build-framework-kong-config';
import { buildApiKeyDefaultLimits } from './build-api-key-default-limits';
import { getDefaultKongPlugins } from './default-plugins';
import { mergeKongConfigs } from './merge-kong-configs';
import { resolveEnvVars, type JsonValue } from './resolve-env-vars';
import { processCorsOrigins } from './process-cors-origins';
import { writeKongBuildContext } from './write-kong-build-context';
import type { KongPlugin, KongTemplate } from './types';
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
  API_KEY_WINDOWS,
  buildApiKeyCounterKey,
  buildApiKeyLastUsedKey,
  buildApiKeyRecordKey,
  encodeApiKeyRecord,
  getApiKeyCounterExpireAt,
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
const TEST_TIMEOUT_MS = 60 * 1000;

const TRUST_TOKEN = 'e2e-trust-token';
const CORS_ORIGIN = 'http://localhost:3000';
const REDIS_PASSWORD = 'e2e-redis-pass';
/** Global rate-limiting minute in the suite's kong.user.yml */
const DEFAULT_MINUTE_LIMIT = 3;
/** framework.apiKeys.ipLimitPerMinute (high: requests come from few IPs) */
const IP_LIMIT_PER_MINUTE = 10_000;
const PARTNER_PATH = '/api/offers/v1/plans';
const KEY_NAMES = ['x-api-key', 'X-Partner-Key'];
const WWW_AUTHENTICATE = 'Key realm="tsdevstack"';

/** Frozen v1 fixture (nest-common api-key-record-v1.fixture.test.ts) */
// expiresAt 2100-01-01: must stay valid for the lifetime of the contract
const V1_FULL =
  '{"v":1,"id":"c0a8f1d2-5b6e-4f3a-9d7c-1e2f3a4b5c6d","consumer":"acme-corp","status":"active","limits":{"minute":60,"hour":1000,"day":10000,"week":50000,"month":100000},"expiresAt":4102444800}';

const dockerAvailable = isDockerAvailable();

if (!dockerAvailable) {
  console.log(
    'Skipping API key plugin Docker tests: Docker is not available (`docker info` failed). Start Docker to run them.',
  );
}

const runId = randomBytes(4).toString('hex');
const prefix = `tsds-apikey-e2e-${runId}`;
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

interface Reply {
  status: number;
  headers: Headers;
  body: string;
}

/** Partner service plugins exactly as the generator emits them */
let generatedPartnerPlugins: KongPlugin[] = [];

/** Generated kong.yml (key plugin and ceiling on the offers partner service) */
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
        ? {
            ...plugin,
            config: { ...plugin.config, minute: DEFAULT_MINUTE_LIMIT },
          }
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

  const partner = resolved.services.find(
    (service) => service.name === 'offers-service-partner',
  )!;
  generatedPartnerPlugins = structuredClone(partner.plugins ?? []);

  // Second key header name (plugin behavior with several key_names)
  const keyPlugin = partner.plugins!.find(
    (plugin) => plugin.name === 'tsdevstack-api-key',
  )!;
  keyPlugin.config.key_names = KEY_NAMES;

  // Access log of the partner service (kong.log.serialize()) on stdout
  partner.plugins!.push({ name: 'file-log', config: { path: '/dev/stdout' } });

  return resolved;
}

/**
 * A random client address per request (Kong trusts X-Forwarded-For from the
 * Docker network), so the per-IP limits never trip across tests.
 */
function randomClientIp(): string {
  const [a, b] = randomBytes(2);
  return `198.18.${a}.${b}`;
}

describe.skipIf(!dockerAvailable)('tsdevstack-api-key plugin (Docker)', () => {
  let tempDir: string | undefined;
  let kongConfig: KongTemplate;
  let echo: RunningContainer | undefined;
  let redisContainer: RunningContainer | undefined;
  let kong: RunningContainer | undefined;
  let redis: Redis;
  let proxyUrl: string;

  async function send(
    requestPath: string,
    headers: Record<string, string> = {},
    method = 'GET',
  ): Promise<Reply> {
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

  /** Sends header lines as given (fetch merges duplicate headers) */
  function sendRawHeaders(
    requestPath: string,
    rawHeaders: string[],
  ): Promise<{ status: number; body: string; wwwAuthenticate?: string }> {
    const url = new URL(proxyUrl);
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: url.hostname,
          port: url.port,
          method: 'GET',
          path: requestPath,
          // Array form: sent as given, without the automatic Host header
          headers: [
            'Host',
            url.host,
            'X-Forwarded-For',
            randomClientIp(),
            ...rawHeaders,
          ],
        },
        (res) => {
          let body = '';
          res.setEncoding('utf-8');
          res.on('data', (chunk: string) => (body += chunk));
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              body,
              wwwAuthenticate: res.headers['www-authenticate'],
            }),
          );
        },
      );
      req.on('error', reject);
      req.end();
    });
  }

  /** Status and error code; every 401 carries WWW-Authenticate */
  function expectDenied(
    reply: Reply | { status: number; body: string; wwwAuthenticate?: string },
    status: number,
    error: string,
  ): void {
    const wwwAuthenticate =
      'headers' in reply
        ? reply.headers.get('www-authenticate')
        : reply.wwwAuthenticate;
    expect({
      status: reply.status,
      error: (JSON.parse(reply.body) as { error?: string }).error,
      wwwAuthenticate: wwwAuthenticate ?? null,
    }).toEqual({
      status,
      error,
      wwwAuthenticate: status === 401 ? WWW_AUTHENTICATE : null,
    });
  }

  /** Seeds a record for a new random key; returns the raw key and its hash */
  async function seedKey(
    overrides: Partial<ApiKeyRecord> = {},
  ): Promise<{ key: string; hash: string; record: ApiKeyRecord }> {
    const key = `tsk_${randomBytes(32).toString('base64url')}`;
    const hash = hashApiKey(key);
    const record: ApiKeyRecord = {
      v: 1,
      id: `key-${randomBytes(6).toString('hex')}`,
      consumer: 'acme-corp',
      status: 'active',
      limits: {},
      ...overrides,
    };
    await redis.set(buildApiKeyRecordKey(hash), encodeApiKeyRecord(record));
    return { key, hash, record };
  }

  /**
   * Redis server time: the Docker VM clock Kong also uses (it can drift from
   * the host clock).
   */
  async function redisNow(): Promise<number> {
    const [seconds] = await redis.time();
    return Number(seconds);
  }

  /**
   * Docker VM time, at least 15 seconds before the end of the minute, so a
   * test's requests all fall in one minute window.
   */
  async function stableNow(): Promise<number> {
    for (;;) {
      const now = await redisNow();
      if (now % 60 < 45) return now;
      await sleep(1000);
    }
  }

  function corsHeaders(reply: Reply): Record<string, string> {
    return Object.fromEntries(
      [...reply.headers.entries()].filter(([name]) =>
        name.startsWith('access-control-'),
      ),
    );
  }

  /**
   * The global cors plugin (one configured origin) adds its headers to every
   * response. A denial must carry exactly those, once: nothing from the key
   * plugin, nothing duplicated (fetch joins repeated headers with ", ").
   */
  async function expectOnlyGlobalCorsHeaders(reply: Reply): Promise<void> {
    const baseline = corsHeaders(await send('/offers/v1/plans/featured'));
    expect(baseline['access-control-allow-origin']).toBe(CORS_ORIGIN);
    expect(corsHeaders(reply)).toEqual(baseline);
  }

  beforeAll(
    async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apikey-e2e-test-'));
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
      const started = await startRedisContainer({
        name: redisName,
        password: REDIS_PASSWORD,
        dockerArgs: ['--network', network],
      });
      redisContainer = started.container;
      redis = new Redis({
        host: '127.0.0.1',
        port: started.port,
        password: REDIS_PASSWORD,
        maxRetriesPerRequest: 1,
      });
      await redis.set(API_KEY_INDEX_MARKER_KEY, '{"v":1,"rebuiltAt":0}');

      const echoPort = await getContainerHostPort(echoName, 3000);
      await waitForHttpOk(
        `http://127.0.0.1:${echoPort}/.well-known/openid-configuration`,
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
      await waitForHttpOk(`http://127.0.0.1:${statusPort}/status/ready`, kong);
    },
    BUILD_TIMEOUT_MS + START_TIMEOUT_MS * 3,
  );

  afterAll(async () => {
    redis?.disconnect();
    await stopAttachedContainer(kongName, kong);
    await stopAttachedContainer(echoName, echo);
    await stopAttachedContainer(redisName, redisContainer);
    spawnSync('docker', ['network', 'rm', network], { stdio: 'ignore' });
    spawnSync('docker', ['rmi', '-f', image], { stdio: 'ignore' });
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }, 120_000);

  describe('generated config', () => {
    it('should run on the generator output: ceiling, key plugin, prefix plugin', () => {
      const redisBlock = {
        host: redisName,
        port: 6379,
        password: REDIS_PASSWORD,
        database: 0,
        timeout: 2000,
      };
      expect(generatedPartnerPlugins).toEqual([
        {
          name: 'rate-limiting',
          config: {
            minute: IP_LIMIT_PER_MINUTE,
            limit_by: 'ip',
            policy: 'redis',
            hide_client_headers: false,
            redis: redisBlock,
          },
        },
        {
          name: 'tsdevstack-api-key',
          config: {
            key_names: ['x-api-key'],
            redis: redisBlock,
            default_limits: { minute: DEFAULT_MINUTE_LIMIT },
          },
        },
        { name: 'tsdevstack-api-prefix', config: { prefix: '/api' } },
      ]);
      expect(JSON.stringify(kongConfig)).not.toContain('key-auth');
    });
  });

  describe('admitted keys', () => {
    it(
      'should forward key id and consumer, never the raw key or forged identity',
      async () => {
        const { key, record } = await seedKey();
        const reply = await send(PARTNER_PATH, {
          'x-api-key': key,
          'X-Api-Key-Id': 'forged-id',
          'X-Api-Key-Consumer': 'forged-consumer',
          'X-Kong-Trust': 'forged-trust',
        });
        expect(reply.status).toBe(200);

        const received = JSON.parse(reply.body) as Echo;
        expect(received.url).toBe('/offers/v1/plans');
        expect(received.headers['x-api-key-id']).toBe(record.id);
        expect(received.headers['x-api-key-consumer']).toBe('acme-corp');
        expect(received.headers['x-api-key']).toBeUndefined();
        expect(received.headers['x-kong-trust']).toBe(TRUST_TOKEN);
        // key-auth is gone: no Kong consumer headers
        expect(received.headers['x-consumer-username']).toBeUndefined();
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should read the frozen v1 fixture record',
      async () => {
        const key = `tsk_${randomBytes(32).toString('base64url')}`;
        await redis.set(buildApiKeyRecordKey(hashApiKey(key)), V1_FULL);
        const reply = await send(PARTNER_PATH, { 'x-api-key': key });
        expect(reply.status).toBe(200);
        const received = JSON.parse(reply.body) as Echo;
        expect(received.headers['x-api-key-id']).toBe(
          'c0a8f1d2-5b6e-4f3a-9d7c-1e2f3a4b5c6d',
        );
        expect(reply.headers.get('x-ratelimit-limit-month')).toBe('100000');
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should count at the contract key names with the contract expiry and set last-used',
      async () => {
        const now = await stableNow();
        const { key, hash } = await seedKey({ limits: { hour: 50 } });
        expect((await send(PARTNER_PATH, { 'x-api-key': key })).status).toBe(
          200,
        );

        for (const window of API_KEY_WINDOWS) {
          const counter = buildApiKeyCounterKey(hash, window, now);
          if (window === 'day') {
            // Neither the key nor default_limits limit the day
            expect(await redis.exists(counter)).toBe(0);
            continue;
          }
          expect({ window, count: await redis.get(counter) }).toEqual({
            window,
            count: '1',
          });
          expect(await redis.expiretime(counter)).toBe(
            getApiKeyCounterExpireAt(window, now),
          );
        }
        const lastUsed = Number(await redis.get(buildApiKeyLastUsedKey(hash)));
        expect(Math.abs(lastUsed - now)).toBeLessThan(5);
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should send rate-limit headers for the key and default windows',
      async () => {
        await stableNow();
        const { key } = await seedKey({ limits: { hour: 50 } });
        const reply = await send(PARTNER_PATH, { 'x-api-key': key });

        expect(reply.status).toBe(200);
        expect(reply.headers.get('x-ratelimit-limit-minute')).toBe(
          String(DEFAULT_MINUTE_LIMIT),
        );
        expect(reply.headers.get('x-ratelimit-remaining-minute')).toBe(
          String(DEFAULT_MINUTE_LIMIT - 1),
        );
        expect(reply.headers.get('x-ratelimit-limit-hour')).toBe('50');
        expect(reply.headers.get('x-ratelimit-remaining-hour')).toBe('49');
        expect(reply.headers.get('x-ratelimit-limit-day')).toBeNull();
        expect(reply.headers.get('ratelimit-limit')).toBe(
          String(DEFAULT_MINUTE_LIMIT),
        );
        expect(reply.headers.get('ratelimit-remaining')).toBe(
          String(DEFAULT_MINUTE_LIMIT - 1),
        );
        const reset = Number(reply.headers.get('ratelimit-reset'));
        expect(reset).toBeGreaterThanOrEqual(1);
        expect(reset).toBeLessThanOrEqual(60);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe('key headers', () => {
    it(
      'should accept the key from any configured header and clear all of them upstream',
      async () => {
        const { key, record } = await seedKey();
        const reply = await send(PARTNER_PATH, { 'x-partner-key': key });
        expect(reply.status).toBe(200);
        const received = JSON.parse(reply.body) as Echo;
        expect(received.headers['x-api-key-id']).toBe(record.id);
        expect(received.headers['x-partner-key']).toBeUndefined();
        expect(received.headers['x-api-key']).toBeUndefined();
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should reject a key sent in two configured headers with api_key_missing',
      async () => {
        const { key } = await seedKey();
        expectDenied(
          await send(PARTNER_PATH, { 'x-api-key': key, 'x-partner-key': key }),
          401,
          'api_key_missing',
        );
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should keep the raw key out of what logging plugins serialize',
      async () => {
        const { key } = await seedKey();
        const other = await seedKey();
        const marker = randomBytes(8).toString('hex');
        expect(
          (await send(`${PARTNER_PATH}?m=${marker}`, { 'x-api-key': key }))
            .status,
        ).toBe(200);
        expectDenied(
          await send(`${PARTNER_PATH}?m=${marker}-denied`, {
            'x-api-key': other.key,
            'x-partner-key': other.key,
          }),
          401,
          'api_key_missing',
        );

        const lines = async (): Promise<string[]> => {
          for (let i = 0; i < 20; i++) {
            const found = kong!.logs
              .join('')
              .split('\n')
              // file-log lines are JSON; nginx access log lines also mention the path
              .filter((line) => line.startsWith('{') && line.includes(marker));
            if (found.length >= 2) return found;
            await sleep(250);
          }
          throw new Error(`No file-log lines for ${marker}`);
        };
        const logged = await lines();
        for (const line of logged) {
          const entry = JSON.parse(line) as {
            request: { headers: Record<string, string> };
          };
          expect(entry.request.headers['x-api-key']).toBeUndefined();
          expect(entry.request.headers['x-partner-key']).toBeUndefined();
          expect(line).not.toContain(key);
          expect(line).not.toContain(other.key);
        }
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should answer 400 to requests with more than 1000 headers',
      async () => {
        const { key } = await seedKey();
        const many: string[] = [];
        for (let i = 0; i < 1001; i++) {
          many.push(`x-filler-${i}`, '1');
        }
        const reply = await sendRawHeaders(PARTNER_PATH, [
          ...many,
          'x-api-key',
          key,
        ]);
        expect(reply.status).toBe(400);
        expect(JSON.parse(reply.body)).toEqual({
          error: 'too_many_headers',
          message: 'Too many request headers',
        });
        // The strip plugin runs first on every route
        const publicReply = await sendRawHeaders(
          '/offers/v1/plans/featured',
          many,
        );
        expect(publicReply.status).toBe(400);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe('401', () => {
    it(
      'should reject a missing, empty or duplicated key with api_key_missing',
      async () => {
        const { key } = await seedKey();
        expectDenied(await send(PARTNER_PATH), 401, 'api_key_missing');
        expectDenied(
          await sendRawHeaders(PARTNER_PATH, ['x-api-key', '']),
          401,
          'api_key_missing',
        );
        expectDenied(
          await sendRawHeaders(PARTNER_PATH, [
            'x-api-key',
            key,
            'X-Api-Key',
            key,
          ]),
          401,
          'api_key_missing',
        );
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should reject an unknown key with invalid_api_key while the index marker exists',
      async () => {
        const reply = await send(PARTNER_PATH, { 'x-api-key': 'tsk_unknown' });
        expectDenied(reply, 401, 'invalid_api_key');
        expect(reply.headers.get('content-type')).toContain('application/json');
        expect(JSON.parse(reply.body)).toEqual({
          error: 'invalid_api_key',
          message: 'Invalid API key',
        });
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should reject a revoked key with api_key_revoked',
      async () => {
        const { key } = await seedKey({ status: 'revoked' });
        expectDenied(
          await send(PARTNER_PATH, { 'x-api-key': key }),
          401,
          'api_key_revoked',
        );
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should reject an expired key with api_key_expired',
      async () => {
        const { key, hash } = await seedKey({
          expiresAt: (await redisNow()) - 1,
        });
        expectDenied(
          await send(PARTNER_PATH, { 'x-api-key': key }),
          401,
          'api_key_expired',
        );
        // Denied calls are not counted
        expect(await redis.keys(`apikey:{${hash}}:*`)).toEqual([
          buildApiKeyRecordKey(hash),
        ]);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe('429', () => {
    it(
      'should stop a key without limits at the default minute limit',
      async () => {
        await stableNow();
        const { key } = await seedKey();
        for (let i = 0; i < DEFAULT_MINUTE_LIMIT; i++) {
          expect((await send(PARTNER_PATH, { 'x-api-key': key })).status).toBe(
            200,
          );
        }
        const reply = await send(PARTNER_PATH, { 'x-api-key': key });
        expectDenied(reply, 429, 'rate_limit_exceeded');
        const retryAfter = Number(reply.headers.get('retry-after'));
        expect(retryAfter).toBeGreaterThanOrEqual(1);
        expect(retryAfter).toBeLessThanOrEqual(60);
        expect(reply.headers.get('x-ratelimit-remaining-minute')).toBe('0');
        expect(reply.headers.get('ratelimit-remaining')).toBe('0');
        await expectOnlyGlobalCorsHeaders(reply);
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should let a key limit above the default pass the default',
      async () => {
        await stableNow();
        const { key } = await seedKey({ limits: { minute: 5 } });
        for (let i = 0; i < 5; i++) {
          expect((await send(PARTNER_PATH, { 'x-api-key': key })).status).toBe(
            200,
          );
        }
        expectDenied(
          await send(PARTNER_PATH, { 'x-api-key': key }),
          429,
          'rate_limit_exceeded',
        );
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should stop a key limit below the default before the default',
      async () => {
        await stableNow();
        const { key } = await seedKey({ limits: { minute: 1 } });
        expect((await send(PARTNER_PATH, { 'x-api-key': key })).status).toBe(
          200,
        );
        expectDenied(
          await send(PARTNER_PATH, { 'x-api-key': key }),
          429,
          'rate_limit_exceeded',
        );
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should answer quota_exceeded for a month limit with Retry-After until the month ends',
      async () => {
        const { key } = await seedKey({ limits: { month: 1 } });
        expect((await send(PARTNER_PATH, { 'x-api-key': key })).status).toBe(
          200,
        );
        const reply = await send(PARTNER_PATH, { 'x-api-key': key });
        expectDenied(reply, 429, 'quota_exceeded');

        const nowSeconds = await redisNow();
        const now = new Date(nowSeconds * 1000);
        const monthEnd =
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1000;
        const expected = monthEnd - nowSeconds;
        expect(
          Math.abs(Number(reply.headers.get('retry-after')) - expected),
        ).toBeLessThan(5);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe('CORS', () => {
    it(
      'should add no CORS headers of its own to denials',
      async () => {
        const cases: Record<string, string>[] = [
          {},
          { 'x-api-key': 'tsk_unknown' },
          { 'x-api-key': 'tsk_unknown', Origin: CORS_ORIGIN },
        ];
        for (const headers of cases) {
          await expectOnlyGlobalCorsHeaders(await send(PARTNER_PATH, headers));
        }
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should leave CORS on denials to the global cors plugin (one allow-origin value)',
      async () => {
        const reply = await send(PARTNER_PATH, { Origin: CORS_ORIGIN });
        expectDenied(reply, 401, 'api_key_missing');
        expect(reply.headers.get('access-control-allow-origin')).toBe(
          CORS_ORIGIN,
        );
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should still answer preflights before the key plugin',
      async () => {
        const reply = await send(
          PARTNER_PATH,
          {
            Origin: CORS_ORIGIN,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'x-api-key',
          },
          'OPTIONS',
        );
        expect(reply.status).toBe(200);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe('503 and Redis failures', () => {
    it(
      'should answer unknown record versions with gateway_unavailable',
      async () => {
        const key = `tsk_${randomBytes(32).toString('base64url')}`;
        await redis.set(
          buildApiKeyRecordKey(hashApiKey(key)),
          '{"v":2,"id":"k","consumer":"acme-corp","status":"active","limits":{}}',
        );
        const reply = await send(PARTNER_PATH, { 'x-api-key': key });
        expectDenied(reply, 503, 'gateway_unavailable');
        expect(reply.headers.get('retry-after')).toBe('5');
        await expectOnlyGlobalCorsHeaders(reply);
        expect(kong!.logs.join('')).toContain('record version 2');
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should answer malformed records with gateway_unavailable',
      async () => {
        const key = `tsk_${randomBytes(32).toString('base64url')}`;
        await redis.set(
          buildApiKeyRecordKey(hashApiKey(key)),
          '{"v":1,"id":"k","consumer":"acme corp","status":"active","limits":{}}',
        );
        const reply = await send(PARTNER_PATH, { 'x-api-key': key });
        expectDenied(reply, 503, 'gateway_unavailable');
        expect(reply.headers.get('retry-after')).toBe('5');
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should answer index_unavailable for unknown keys while the marker is missing',
      async () => {
        const { key } = await seedKey();
        await redis.del(API_KEY_INDEX_MARKER_KEY);
        try {
          const reply = await send(PARTNER_PATH, {
            'x-api-key': 'tsk_unknown',
          });
          expectDenied(reply, 503, 'index_unavailable');
          expect(reply.headers.get('retry-after')).toBe('5');
          // Keys with a record keep working without the marker
          expect((await send(PARTNER_PATH, { 'x-api-key': key })).status).toBe(
            200,
          );
        } finally {
          await redis.set(API_KEY_INDEX_MARKER_KEY, '{"v":1,"rebuiltAt":0}');
        }
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should run the script again after Redis lost its script cache (NOSCRIPT)',
      async () => {
        const { key } = await seedKey();
        expect((await send(PARTNER_PATH, { 'x-api-key': key })).status).toBe(
          200,
        );
        await redis.script('FLUSH');
        expect((await send(PARTNER_PATH, { 'x-api-key': key })).status).toBe(
          200,
        );
        expect((await send(PARTNER_PATH, { 'x-api-key': key })).status).toBe(
          200,
        );
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should fail closed with gateway_unavailable when Redis is down, other routes unaffected',
      async () => {
        const { key } = await seedKey();
        redis.disconnect();
        await stopAttachedContainer(redisName, redisContainer);
        redisContainer = undefined;

        const reply = await send(PARTNER_PATH, { 'x-api-key': key });
        expectDenied(reply, 503, 'gateway_unavailable');
        expect(reply.headers.get('retry-after')).toBe('5');
        await expectOnlyGlobalCorsHeaders(reply);

        // Public route: no key plugin (the global limiter is fault tolerant)
        expect((await send('/offers/v1/plans/featured')).status).toBe(200);
      },
      TEST_TIMEOUT_MS,
    );
  });
});
