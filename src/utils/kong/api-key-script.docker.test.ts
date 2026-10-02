/**
 * Docker-backed test of the Redis script shipped in the tsdevstack-api-key
 * Kong plugin (templates/kong-plugins/tsdevstack-api-key/script.lua), run
 * against a real Redis in standalone and in cluster mode (one node owning
 * every slot: it still rejects multi-key calls across slots with CROSSSLOT,
 * like a clustered cloud Redis).
 *
 * The script source is read from the plugin folder, not copied. Records and
 * key names come from the TypeScript contract in @tsdevstack/nest-common, so
 * the script is checked against the same encoder and key builders the
 * auth-service uses. The plugin's Lua window math (windows.lua) and the
 * script's SHA1 are checked against the contract inside the Kong image with
 * `resty`.
 *
 * The handler's own logic (marker lookup, NOSCRIPT fallback, headers, error
 * responses) is covered by api-key-plugin.docker.test.ts.
 *
 * Every container is named `tsds-apikey-script-<random>-*`. If a run is
 * killed before afterAll, clean up with:
 *   docker ps -a --filter name=tsds-apikey-script- -q | xargs docker rm -f
 */

import { describe, it, expect, beforeAll, afterAll } from '@rstest/core';
import { spawnSync } from 'child_process';
import { createHash, randomBytes } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import Redis from 'ioredis';
import type {
  ApiKeyRecord,
  ApiKeyRecordLimits,
  ApiKeyWindow,
} from '@tsdevstack/nest-common';
import {
  isDockerAvailable,
  runDocker,
  sleep,
  startRedisContainer,
  stopAttachedContainer,
  type RunningContainer,
} from '../../test-utils/docker';
import {
  getApiKeyPluginDir,
  loadApiKeyContract,
  readApiKeyScriptSource,
} from '../../test-utils/kong';

const {
  API_KEY_INDEX_MARKER_KEY,
  API_KEY_LAST_USED_TTL_SECONDS,
  API_KEY_WINDOW_KEY_SEGMENTS,
  API_KEY_WINDOWS,
  buildApiKeyCounterKey,
  buildApiKeyLastUsedKey,
  buildApiKeyRecordKey,
  decodeApiKeyRecord,
  encodeApiKeyRecord,
  getApiKeyCounterExpireAt,
  getApiKeyWindowEnd,
  getApiKeyWindowId,
  getApiKeyWindowStart,
  hashApiKey,
} = loadApiKeyContract();

const KONG_IMAGE = 'kong:3.8.0';
const START_TIMEOUT_MS = 120_000;
const TEST_TIMEOUT_MS = 60_000;

/**
 * Frozen v1 records, byte for byte the fixtures in nest-common's
 * api-key-record-v1.fixture.test.ts. DO NOT CHANGE OR REMOVE: every plugin
 * version must keep reading them.
 */
// expiresAt 2100-01-01: must stay valid for the lifetime of the contract
const V1_FULL =
  '{"v":1,"id":"c0a8f1d2-5b6e-4f3a-9d7c-1e2f3a4b5c6d","consumer":"acme-corp","status":"active","limits":{"minute":60,"hour":1000,"day":10000,"week":50000,"month":100000},"expiresAt":4102444800}';
const V1_MINIMAL =
  '{"v":1,"id":"clx1234567890abcdef","consumer":"acme-corp","status":"active","limits":{}}';
const V1_REVOKED =
  '{"v":1,"id":"clx1234567890abcdef","consumer":"acme-corp","status":"revoked","limits":{"minute":5}}';

const dockerAvailable = isDockerAvailable();

if (!dockerAvailable) {
  console.log(
    'Skipping API key script Docker tests: Docker is not available (`docker info` failed). Start Docker to run them.',
  );
}

const runId = randomBytes(4).toString('hex');
const prefix = `tsds-apikey-script-${runId}`;
const source = readApiKeyScriptSource();
const sourceSha1 = createHash('sha1').update(source, 'utf8').digest('hex');

/** What the script returns (JSON) */
interface ScriptResult {
  status:
    | 'missing'
    | 'unsupported_version'
    | 'malformed'
    | 'revoked'
    | 'expired'
    | 'limited'
    | 'ok';
  id?: string;
  consumer?: string;
  limits?: number[];
  counts?: number[];
  v?: number;
  reason?: string;
}

type Defaults = ApiKeyRecordLimits;

/** Every Redis key one request touches, built with the contract builders */
function buildKeys(keyHash: string, now: number): string[] {
  return [
    buildApiKeyRecordKey(keyHash),
    ...API_KEY_WINDOWS.map((window) =>
      buildApiKeyCounterKey(keyHash, window, now),
    ),
    buildApiKeyLastUsedKey(keyHash),
  ];
}

/** ARGV as the handler builds it */
function buildArgs(now: number, defaults: Defaults): string[] {
  return [
    String(now),
    ...API_KEY_WINDOWS.map((window) =>
      String(getApiKeyCounterExpireAt(window, now)),
    ),
    ...API_KEY_WINDOWS.map((window) => String(defaults[window] ?? 0)),
  ];
}

function windowIndex(window: ApiKeyWindow): number {
  return API_KEY_WINDOWS.indexOf(window);
}

/**
 * Redis server time (the Docker VM clock, which Redis uses for TTLs and can
 * drift from the host clock), at least 10 seconds before the end of the
 * minute, so the minute counter a test writes does not expire while the
 * test runs.
 */
async function stableNow(redis: Redis): Promise<number> {
  for (;;) {
    const [seconds] = await redis.time();
    const now = Number(seconds);
    if (now % 60 < 50) return now;
    await sleep(1000);
  }
}

function newKey(): { raw: string; hash: string } {
  const raw = `tsk_${randomBytes(16).toString('base64url')}`;
  return { raw, hash: hashApiKey(raw) };
}

function record(overrides: Partial<ApiKeyRecord> = {}): ApiKeyRecord {
  return {
    v: 1,
    id: `key-${randomBytes(4).toString('hex')}`,
    consumer: 'acme-corp',
    status: 'active',
    limits: {},
    ...overrides,
  };
}

describe.skipIf(!dockerAvailable)('tsdevstack-api-key script (Docker)', () => {
  describe('plugin Lua against the contract (Kong image)', () => {
    /** Runs a Lua chunk with `resty` in the Kong image, plugin mounted */
    function resty(code: string): string {
      return runDocker(
        [
          'run',
          '--rm',
          '-v',
          `${getApiKeyPluginDir()}:/plugin/kong/plugins/tsdevstack-api-key:ro`,
          '--entrypoint',
          'resty',
          KONG_IMAGE,
          '-I',
          '/plugin',
          '-e',
          code,
        ],
        START_TIMEOUT_MS,
      );
    }

    it(
      'should compute windows exactly like the TypeScript contract',
      () => {
        const base = [
          0,
          1790709764, // 2026-09-29T19:22:44Z (the fixture time)
          1790553600 - 1, // Sunday 23:59:59 before a Monday
          1790553600, // Monday 00:00:00
          Date.UTC(2024, 1, 29, 23, 59, 59) / 1000, // leap day
          Date.UTC(2024, 2, 1) / 1000,
          Date.UTC(2025, 11, 31, 23, 59, 59) / 1000, // year end
          Date.UTC(2026, 0, 1) / 1000,
          Date.UTC(2026, 0, 1) / 1000 - 1,
          Date.UTC(2100, 1, 28, 12) / 1000, // not a leap year
          Math.floor(Date.now() / 1000),
        ];
        // Plus one timestamp every 1.37 days over two years
        for (
          let t = 1767225600;
          t < 1767225600 + 2 * 365 * 86400;
          t += 118368
        ) {
          base.push(t);
        }

        const output = resty(`
          local w = require "kong.plugins.tsdevstack-api-key.windows"
          for _, t in ipairs({ ${base.join(', ')} }) do
            for _, e in ipairs(w.compute(t)) do
              print(string.format("%d %s %s %s %d %d %d", t, e.name, e.segment, e.id, e.start, e.ends, e.expire_at))
            end
          end
        `);

        const expected = base.flatMap((t) =>
          API_KEY_WINDOWS.map(
            (window) =>
              `${t} ${window} ${API_KEY_WINDOW_KEY_SEGMENTS[window]} ${getApiKeyWindowId(window, t)} ${getApiKeyWindowStart(window, t)} ${getApiKeyWindowEnd(window, t)} ${getApiKeyCounterExpireAt(window, t)}`,
          ),
        );
        expect(output.split('\n')).toEqual(expected);
      },
      START_TIMEOUT_MS,
    );

    it(
      'should ship the SHA1 of the script source it embeds',
      () => {
        const output = resty(`
          local s = require "kong.plugins.tsdevstack-api-key.script"
          print(s.sha1)
          print(#s.source)
        `);
        expect(output.split('\n')).toEqual([
          sourceSha1,
          String(Buffer.byteLength(source, 'utf8')),
        ]);
      },
      START_TIMEOUT_MS,
    );

    /** `kong config parse` of one service with the plugin; output and status */
    function parsePluginConfig(config: Record<string, unknown>): {
      ok: boolean;
      output: string;
    } {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apikey-schema-'));
      try {
        const file = path.join(dir, 'kong.yml');
        fs.writeFileSync(
          file,
          yaml.dump({
            _format_version: '3.0',
            services: [
              {
                name: 's',
                url: 'http://upstream:3000',
                plugins: [{ name: 'tsdevstack-api-key', config }],
                routes: [{ name: 'r', paths: ['/api'] }],
              },
            ],
          }),
        );
        const result = spawnSync(
          'docker',
          [
            'run',
            '--rm',
            '-v',
            `${getApiKeyPluginDir()}:/usr/local/share/lua/5.1/kong/plugins/tsdevstack-api-key:ro`,
            '-v',
            `${file}:/kong.yml:ro`,
            '-e',
            'KONG_DATABASE=off',
            '-e',
            'KONG_PLUGINS=bundled,tsdevstack-api-key',
            KONG_IMAGE,
            'kong',
            'config',
            'parse',
            '/kong.yml',
          ],
          { encoding: 'utf-8', timeout: START_TIMEOUT_MS },
        );
        return {
          ok: result.status === 0,
          output: `${result.stdout}${result.stderr}`,
        };
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }

    it(
      'should accept a full config and apply the defaults',
      () => {
        const result = parsePluginConfig({
          redis: { host: 'redis' },
          key_names: ['x-api-key', 'x-partner-key'],
          default_limits: { minute: 1, month: 2147483647 },
        });
        expect(result.output).toContain('parse successful');
        expect(parsePluginConfig({ redis: { host: 'redis' } }).ok).toBe(true);
      },
      START_TIMEOUT_MS,
    );

    it(
      'should reject configs that break the schema rules',
      () => {
        const cases: [Record<string, unknown>, RegExp][] = [
          [
            {},
            /at least one of these fields must be non-empty: 'config.redis.host'/,
          ],
          [
            { redis: { host: 'redis' }, key_names: ['x-api-key', 'X-Api-Key'] },
            /duplicate key name/,
          ],
          [{ redis: { host: 'redis' }, key_names: [] }, /key_names/],
          [
            { redis: { host: 'redis' }, default_limits: { minute: 0 } },
            /between 1 and 2147483647/,
          ],
          [
            { redis: { host: 'redis' }, default_limits: { month: 2147483648 } },
            /between 1 and 2147483647/,
          ],
          [
            { redis: { host: 'redis' }, default_limits: { second: 1 } },
            /unknown field/,
          ],
        ];
        for (const [config, message] of cases) {
          const result = parsePluginConfig(config);
          expect({ config, ok: result.ok }).toEqual({ config, ok: false });
          expect(result.output).toMatch(message);
        }
      },
      START_TIMEOUT_MS * 2,
    );
  });

  describe.each([
    { mode: 'standalone', cluster: false },
    { mode: 'cluster', cluster: true },
  ])('Redis $mode', ({ mode, cluster }) => {
    const name = `${prefix}-${mode}`;
    let container: RunningContainer | undefined;
    let redis: Redis;

    async function run(
      keyHash: string,
      now: number,
      defaults: Defaults = {},
    ): Promise<ScriptResult> {
      const keys = buildKeys(keyHash, now);
      const reply = (await redis.evalsha(
        sourceSha1,
        keys.length,
        ...keys,
        ...buildArgs(now, defaults),
      )) as string;
      return JSON.parse(reply) as ScriptResult;
    }

    async function seed(keyHash: string, value: string): Promise<void> {
      await redis.set(buildApiKeyRecordKey(keyHash), value);
    }

    async function keysOf(keyHash: string): Promise<string[]> {
      return (await redis.keys(`apikey:{${keyHash}}:*`)).sort();
    }

    beforeAll(async () => {
      const started = await startRedisContainer({ name, cluster });
      container = started.container;
      redis = new Redis({
        host: '127.0.0.1',
        port: started.port,
        maxRetriesPerRequest: 1,
      });
      expect(await redis.script('LOAD', source)).toBe(sourceSha1);
    }, START_TIMEOUT_MS);

    afterAll(async () => {
      redis?.disconnect();
      await stopAttachedContainer(name, container);
    }, 60_000);

    describe('key layout', () => {
      it(
        'should keep every key of one call in one hash slot',
        async () => {
          const { hash } = newKey();
          const keys = buildKeys(hash, await stableNow(redis));
          expect(keys).toHaveLength(7);
          // Same hash tag everywhere: the first {...} of every key is the hash
          expect(
            new Set(keys.map((key) => /\{([^}]*)\}/.exec(key)?.[1])),
          ).toEqual(new Set([hash]));

          if (!cluster) return;
          const slots = await Promise.all(
            keys.map((key) => redis.cluster('KEYSLOT', key)),
          );
          expect(new Set(slots).size).toBe(1);
          // The marker is in another slot: it can never be part of the call
          expect(
            await redis.cluster('KEYSLOT', API_KEY_INDEX_MARKER_KEY),
          ).not.toBe(slots[0]);
          // Control: without the hash tag this node rejects the call
          await expect(
            redis.evalsha(
              sourceSha1,
              2,
              `apikey:${hash}:rec`,
              `apikey:${hash}:lu`,
            ),
          ).rejects.toThrow(/CROSSSLOT/);
        },
        TEST_TIMEOUT_MS,
      );
    });

    describe('frozen v1 fixtures', () => {
      it(
        'should admit the full v1 record before its expiry and apply its limits',
        async () => {
          const { hash } = newKey();
          await seed(hash, V1_FULL);
          const now = await stableNow(redis);
          expect(now).toBeLessThan(4102444800);

          const result = await run(hash, now);
          expect(result).toEqual({
            status: 'ok',
            id: 'c0a8f1d2-5b6e-4f3a-9d7c-1e2f3a4b5c6d',
            consumer: 'acme-corp',
            limits: [60, 1000, 10000, 50000, 100000],
            counts: [1, 1, 1, 1, 1],
          });
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should report the full v1 record as expired from its expiresAt second on',
        async () => {
          const { hash } = newKey();
          await seed(hash, V1_FULL);
          // Fixed times far from now: nothing is written for denied calls
          expect((await run(hash, 4102444800)).status).toBe('expired');
          expect((await run(hash, 4102444801)).status).toBe('expired');
          expect(await keysOf(hash)).toEqual([buildApiKeyRecordKey(hash)]);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should admit the minimal v1 record without limits',
        async () => {
          const { hash } = newKey();
          await seed(hash, V1_MINIMAL);
          const result = await run(hash, await stableNow(redis));
          expect(result).toEqual({
            status: 'ok',
            id: 'clx1234567890abcdef',
            consumer: 'acme-corp',
            limits: [0, 0, 0, 0, 0],
            counts: [0, 0, 0, 1, 1],
          });
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should report the revoked v1 record as revoked',
        async () => {
          const { hash } = newKey();
          await seed(hash, V1_REVOKED);
          expect(await run(hash, await stableNow(redis))).toEqual({
            status: 'revoked',
          });
          expect(await keysOf(hash)).toEqual([buildApiKeyRecordKey(hash)]);
        },
        TEST_TIMEOUT_MS,
      );

      it('should keep every fixture byte-identical through the nest-common decoder and encoder', () => {
        for (const fixture of [V1_FULL, V1_MINIMAL, V1_REVOKED]) {
          expect(encodeApiKeyRecord(decodeApiKeyRecord(fixture))).toBe(fixture);
        }
      });
    });

    describe('record checks', () => {
      it(
        'should report a missing record and write nothing',
        async () => {
          const { hash } = newKey();
          expect(await run(hash, await stableNow(redis))).toEqual({
            status: 'missing',
          });
          expect(await keysOf(hash)).toEqual([]);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should report an unknown record version with the version',
        async () => {
          const { hash } = newKey();
          await seed(
            hash,
            '{"v":2,"id":"k","consumer":"acme-corp","status":"active","limits":{},"scopes":["x"]}',
          );
          expect(await run(hash, await stableNow(redis))).toEqual({
            status: 'unsupported_version',
            v: 2,
          });
          expect(await keysOf(hash)).toEqual([buildApiKeyRecordKey(hash)]);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should report records that break the contract as malformed',
        async () => {
          const cases: [string, RegExp][] = [
            ['not json', /not a JSON object/],
            ['"a string"', /not a JSON object/],
            [
              '{"id":"k","consumer":"c","status":"active","limits":{}}',
              /v is missing/,
            ],
            [
              '{"v":"1","id":"k","consumer":"c","status":"active","limits":{}}',
              /v is missing or not a number/,
            ],
            ['{"v":1,"consumer":"c","status":"active","limits":{}}', /id/],
            [
              '{"v":1,"id":"a b","consumer":"c","status":"active","limits":{}}',
              /id/,
            ],
            [
              `{"v":1,"id":"${'k'.repeat(129)}","consumer":"c","status":"active","limits":{}}`,
              /id/,
            ],
            [
              '{"v":1,"id":"k","consumer":"c\\r\\nx","status":"active","limits":{}}',
              /consumer/,
            ],
            [
              '{"v":1,"id":"k","consumer":"c","status":"ACTIVE","limits":{}}',
              /status/,
            ],
            ['{"v":1,"id":"k","consumer":"c","status":"active"}', /limits/],
            [
              '{"v":1,"id":"k","consumer":"c","status":"active","limits":null}',
              /limits/,
            ],
            [
              '{"v":1,"id":"k","consumer":"c","status":"active","limits":{"second":1}}',
              /unknown window/,
            ],
            [
              '{"v":1,"id":"k","consumer":"c","status":"active","limits":{"minute":0}}',
              /minute/,
            ],
            [
              '{"v":1,"id":"k","consumer":"c","status":"active","limits":{"minute":1.5}}',
              /minute/,
            ],
            [
              '{"v":1,"id":"k","consumer":"c","status":"active","limits":{"minute":2147483648}}',
              /minute/,
            ],
            [
              '{"v":1,"id":"k","consumer":"c","status":"active","limits":{},"expiresAt":null}',
              /expiresAt/,
            ],
            [
              '{"v":1,"id":"k","consumer":"c","status":"active","limits":{},"expiresAt":-5}',
              /expiresAt/,
            ],
          ];
          const now = await stableNow(redis);
          for (const [value, reason] of cases) {
            const { hash } = newKey();
            await seed(hash, value);
            const result = await run(hash, now);
            expect({ value, status: result.status }).toEqual({
              value,
              status: 'malformed',
            });
            expect(result.reason).toMatch(reason);
            expect(await keysOf(hash)).toEqual([buildApiKeyRecordKey(hash)]);
          }
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should ignore unknown extra fields of a v1 record',
        async () => {
          const { hash } = newKey();
          await seed(
            hash,
            '{"v":1,"id":"k","consumer":"c","status":"active","limits":{},"note":"x"}',
          );
          expect((await run(hash, await stableNow(redis))).status).toBe('ok');
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should report a revoked key even when it is also expired',
        async () => {
          const { hash } = newKey();
          await seed(
            hash,
            encodeApiKeyRecord(record({ status: 'revoked', expiresAt: 1000 })),
          );
          expect((await run(hash, await stableNow(redis))).status).toBe(
            'revoked',
          );
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should admit a key until the second before expiresAt',
        async () => {
          const { hash } = newKey();
          const now = await stableNow(redis);
          await seed(hash, encodeApiKeyRecord(record({ expiresAt: now + 1 })));
          expect((await run(hash, now)).status).toBe('ok');
          expect((await run(hash, now + 1)).status).toBe('expired');
        },
        TEST_TIMEOUT_MS,
      );
    });

    describe('limits', () => {
      it.each([...API_KEY_WINDOWS])(
        'should stop a key at its own %s limit without counting the denied call',
        async (window) => {
          const { hash } = newKey();
          const now = await stableNow(redis);
          await seed(
            hash,
            encodeApiKeyRecord(record({ limits: { [window]: 2 } })),
          );
          const index = windowIndex(window);

          expect((await run(hash, now)).counts![index]).toBe(1);
          expect((await run(hash, now)).counts![index]).toBe(2);

          const denied = await run(hash, now);
          expect(denied.status).toBe('limited');
          expect(denied.limits![index]).toBe(2);
          expect(denied.counts![index]).toBe(2);

          const counter = buildApiKeyCounterKey(hash, window, now);
          expect(await redis.get(counter)).toBe('2');
          expect(await redis.expiretime(counter)).toBe(
            getApiKeyCounterExpireAt(window, now),
          );
        },
        TEST_TIMEOUT_MS,
      );

      it.each([...API_KEY_WINDOWS])(
        'should fall back to the default %s limit when the key has none',
        async (window) => {
          const { hash } = newKey();
          const now = await stableNow(redis);
          await seed(hash, encodeApiKeyRecord(record()));
          const defaults = { [window]: 2 };
          const index = windowIndex(window);

          expect((await run(hash, now, defaults)).status).toBe('ok');
          const second = await run(hash, now, defaults);
          expect(second.status).toBe('ok');
          expect(second.limits![index]).toBe(2);
          expect((await run(hash, now, defaults)).status).toBe('limited');
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should let a key limit above the default pass the default',
        async () => {
          const { hash } = newKey();
          const now = await stableNow(redis);
          await seed(
            hash,
            encodeApiKeyRecord(record({ limits: { minute: 5 } })),
          );
          const defaults = { minute: 2 };

          for (let i = 1; i <= 5; i++) {
            const result = await run(hash, now, defaults);
            expect(result.status).toBe('ok');
            expect(result.limits![0]).toBe(5);
          }
          expect((await run(hash, now, defaults)).status).toBe('limited');
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should stop a key limit below the default before the default',
        async () => {
          const { hash } = newKey();
          const now = await stableNow(redis);
          await seed(hash, encodeApiKeyRecord(record({ limits: { hour: 1 } })));
          const defaults = { hour: 3 };

          expect((await run(hash, now, defaults)).status).toBe('ok');
          const denied = await run(hash, now, defaults);
          expect(denied.status).toBe('limited');
          expect(denied.limits![1]).toBe(1);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should combine key limits and defaults per window',
        async () => {
          const { hash } = newKey();
          const now = await stableNow(redis);
          await seed(hash, encodeApiKeyRecord(record({ limits: { day: 10 } })));
          const defaults = { minute: 3, day: 1, month: 100 };

          const result = await run(hash, now, defaults);
          expect(result).toMatchObject({
            status: 'ok',
            limits: [3, 0, 10, 0, 100],
            counts: [1, 0, 1, 1, 1],
          });
          await run(hash, now, defaults);
          await run(hash, now, defaults);
          const denied = await run(hash, now, defaults);
          expect(denied).toMatchObject({
            status: 'limited',
            counts: [3, 0, 3, 3, 3],
          });
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should count against counters seeded by the key owner (week and month totals)',
        async () => {
          const { hash } = newKey();
          const now = await stableNow(redis);
          await seed(
            hash,
            encodeApiKeyRecord(record({ limits: { month: 10 } })),
          );
          const month = buildApiKeyCounterKey(hash, 'month', now);
          await redis.set(
            month,
            '9',
            'EXAT',
            getApiKeyCounterExpireAt('month', now),
          );

          expect((await run(hash, now)).counts![4]).toBe(10);
          expect((await run(hash, now)).status).toBe('limited');
        },
        TEST_TIMEOUT_MS,
      );
    });

    describe('counters and last-used', () => {
      it(
        'should give each counter the contract expiry and count week and month always',
        async () => {
          const { hash } = newKey();
          const now = await stableNow(redis);
          await seed(
            hash,
            encodeApiKeyRecord(record({ limits: { minute: 100 } })),
          );
          await run(hash, now, { day: 1000 });

          for (const window of API_KEY_WINDOWS) {
            const counter = buildApiKeyCounterKey(hash, window, now);
            if (window === 'hour') {
              // Not limited by the key or the defaults: no counter
              expect(await redis.exists(counter)).toBe(0);
              continue;
            }
            expect(await redis.get(counter)).toBe('1');
            expect(await redis.expiretime(counter)).toBe(
              getApiKeyCounterExpireAt(window, now),
            );
          }
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should repair a counter that has no TTL',
        async () => {
          const { hash } = newKey();
          const now = await stableNow(redis);
          await seed(hash, encodeApiKeyRecord(record()));
          const week = buildApiKeyCounterKey(hash, 'week', now);
          await redis.set(week, '4');

          expect((await run(hash, now)).counts![3]).toBe(5);
          expect(await redis.expiretime(week)).toBe(
            getApiKeyCounterExpireAt('week', now),
          );
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should write the last-used time at most every 60 seconds with a 30-day TTL',
        async () => {
          const { hash } = newKey();
          const now = await stableNow(redis);
          await seed(hash, encodeApiKeyRecord(record()));
          const lastUsed = buildApiKeyLastUsedKey(hash);

          await run(hash, now);
          expect(await redis.get(lastUsed)).toBe(String(now));
          const ttl = await redis.ttl(lastUsed);
          expect(ttl).toBeGreaterThan(API_KEY_LAST_USED_TTL_SECONDS - 10);
          expect(ttl).toBeLessThanOrEqual(API_KEY_LAST_USED_TTL_SECONDS);

          await run(hash, now + 59);
          expect(await redis.get(lastUsed)).toBe(String(now));

          await run(hash, now + 60);
          expect(await redis.get(lastUsed)).toBe(String(now + 60));
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should not touch counters or last-used for denied calls',
        async () => {
          const { hash } = newKey();
          const now = await stableNow(redis);
          await seed(
            hash,
            encodeApiKeyRecord(record({ limits: { minute: 1 } })),
          );
          expect((await run(hash, now)).status).toBe('ok');
          const keys = buildKeys(hash, now);
          const snapshot = await redis.mget(...keys);

          expect((await run(hash, now)).status).toBe('limited');
          expect((await run(hash, now)).status).toBe('limited');
          expect(await redis.mget(...keys)).toEqual(snapshot);
          expect(snapshot[5]).toBe('1');
        },
        TEST_TIMEOUT_MS,
      );
    });

    describe('script cache', () => {
      it(
        'should answer NOSCRIPT after SCRIPT FLUSH and run again through EVAL',
        async () => {
          const { hash } = newKey();
          const now = await stableNow(redis);
          await seed(hash, encodeApiKeyRecord(record()));
          await redis.script('FLUSH');

          await expect(run(hash, now)).rejects.toThrow(/NOSCRIPT/);

          const keys = buildKeys(hash, now);
          const reply = (await redis.eval(
            source,
            keys.length,
            ...keys,
            ...buildArgs(now, {}),
          )) as string;
          expect((JSON.parse(reply) as ScriptResult).status).toBe('ok');
          // EVAL cached the script again under the same SHA1
          expect((await run(hash, now)).status).toBe('ok');
        },
        TEST_TIMEOUT_MS,
      );
    });
  });
});
