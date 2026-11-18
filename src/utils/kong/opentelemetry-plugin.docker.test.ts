/**
 * Docker-backed end-to-end test of the tsdevstack-opentelemetry Kong plugin
 * (Kong's OpenTelemetry plugin with parent-based sampling) in the generated
 * Kong image.
 *
 * The Kong config is generated like generate-kong does, with the framework
 * global plugins and the public routes of the offers-service fixture, at a
 * sample rate of 0: a trace is only kept when the frontend sampled it. The
 * echo upstream (the backend) answers with the headers it received, so the
 * tests read the traceparent Kong passed on (its last field: 01 sampled, 00
 * not) and its copy in X-Tsdevstack-Traceparent. Kong exports its spans to
 * the echo server too, which keeps them, so the tests can also look for a
 * trace ID in what Kong sent.
 *
 * Containers run as attached child processes (`docker run --rm`, no -d) on a
 * dedicated network and are removed in afterAll, together with the image,
 * the network and the temp directory. Skipped with a message when Docker is
 * not available.
 *
 * Every resource is named `tsds-otel-e2e-<pid>-<random>-*`. A run killed
 * before afterAll leaves them behind; the next run removes them at start
 * (removeStaleDockerResources). To clean up by hand:
 *   docker ps -a --filter name=tsds-otel-e2e- -q | xargs docker rm -f
 *   docker network ls --filter name=tsds-otel-e2e- -q | xargs docker network rm
 *   docker images --filter reference='tsds-otel-e2e-*' -q | xargs docker rmi -f
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
import { mergeKongConfigs } from './merge-kong-configs';
import { resolveEnvVars, type JsonValue } from './resolve-env-vars';
import { buildKongRuntimeSecretReferences } from './build-kong-runtime-secret-references';
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
  stopAttachedContainer,
  waitForHttpOk,
  type RunningContainer,
} from '../../test-utils/docker';
import {
  KONG_FRONTEND_TOKEN_HEADER,
  KONG_TRACEPARENT_COPY_HEADER,
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
/** How long Kong may take to export a span (its queue sends after 1 s) */
const EXPORT_WAIT_MS = 15_000;

const FRONTEND_TOKEN = 'e2e-frontend-token-0123456789abcdef0123456789abcdef';
const TRUST_TOKEN = 'e2e-trust-token';
const PUBLIC_PATH = '/offers/v1/plans/featured';
const PARENT_SPAN_ID = '53995c3f42cd8ad8';
/** The span a platform in front of Kong (Cloud Run) would put in traceparent */
const PLATFORM_SPAN_ID = 'a1b2c3d4e5f60718';

const dockerAvailable = isDockerAvailable();

if (!dockerAvailable) {
  console.log(
    'Skipping OpenTelemetry plugin Docker tests: Docker is not available (`docker info` failed). Start Docker to run them.',
  );
}

const RESOURCE_BASE = 'tsds-otel-e2e';
const prefix = buildDockerTestPrefix(RESOURCE_BASE);
const network = `${prefix}-net`;
const image = `${prefix}-kong`;
const echoName = `${prefix}-echo`;
const kongName = `${prefix}-kong`;
const echoUrl = `http://${echoName}:3000`;

/** The traceparent the backend received, split up */
interface BackendTrace {
  traceId: string | undefined;
  flags: string | undefined;
}

/** What the backend received: its traceparent and the copy */
interface BackendHeaders {
  traceparent: string | undefined;
  copy: string | undefined;
}

/** Generated kong.yml: framework global plugins, public routes, rate 0 */
function generateKongConfig(): KongTemplate {
  const parsed = parseOpenApiSecurity(
    'offers-service',
    path.join(FIXTURE_DIR, 'offers-service.openapi.json'),
  );

  // Public routes only: no OIDC provider or Redis needed
  const services = generateSecurityBasedServices({
    serviceName: 'offers-service',
    serviceUrl: '${KONG_SERVICE_HOST}',
    globalPrefix: 'offers',
    groupedRoutes: { ...parsed.groupedRoutes, jwt: [], partner: [] },
    // Unused without partner routes
    partnerApi: { defaultLimits: {}, ipLimitPerMinute: 10_000 },
    oidcDiscoveryUrl: '${OIDC_DISCOVERY_URL}',
  });

  const merged = mergeKongConfigs(
    buildFrameworkKongConfig(services, {
      tracesEndpoint: `${echoUrl}/v1/traces`,
      sampleRate: 0,
    }),
    { _format_version: '3.0', _transform: true, services: [], plugins: [] },
  );

  return resolveEnvVars(merged as unknown as JsonValue, {
    KONG_SERVICE_HOST: echoUrl,
    OIDC_DISCOVERY_URL: `${echoUrl}/.well-known/openid-configuration`,
    // Kong reads these from its environment, as in production
    ...buildKongRuntimeSecretReferences(),
  }) as unknown as KongTemplate;
}

/** A new random trace ID */
function newTraceId(): string {
  return randomBytes(16).toString('hex');
}

/** A W3C traceparent for the trace, sampled or not */
function traceparent(
  traceId: string,
  sampled: boolean,
  parentId = PARENT_SPAN_ID,
): string {
  return `00-${traceId}-${parentId}-${sampled ? '01' : '00'}`;
}

/** A fresh client address */
function randomIp(): string {
  const [a, b] = randomBytes(2);
  return `198.18.${a}.${b}`;
}

describe.skipIf(!dockerAvailable)(
  'tsdevstack-opentelemetry plugin (Docker)',
  () => {
    let tempDir: string | undefined;
    let echo: RunningContainer | undefined;
    let kong: RunningContainer | undefined;
    let proxyUrl: string;
    let echoHostUrl: string;

    /** Sends a request through Kong; returns the backend's trace headers */
    async function sendRaw(
      headers: Record<string, string>,
    ): Promise<BackendHeaders> {
      const response = await fetch(`${proxyUrl}${PUBLIC_PATH}`, {
        headers: { 'X-Forwarded-For': randomIp(), ...headers },
      });
      expect(response.status).toBe(200);
      const received = (await response.json()) as {
        headers: Record<string, string | undefined>;
      };
      return {
        traceparent: received.headers.traceparent,
        copy: received.headers[KONG_TRACEPARENT_COPY_HEADER.toLowerCase()],
      };
    }

    /** Sends a request through Kong; returns the backend's traceparent */
    async function send(
      headers: Record<string, string>,
    ): Promise<BackendTrace> {
      const parts = (await sendRaw(headers)).traceparent?.split('-');
      return { traceId: parts?.[1], flags: parts?.[3] };
    }

    /** The frontend's headers, with its traceparent */
    function fromFrontend(parent: string): Record<string, string> {
      return {
        [KONG_FRONTEND_TOKEN_HEADER]: FRONTEND_TOKEN,
        traceparent: parent,
      };
    }

    /** Whether Kong's span export so far contains the trace ID */
    async function exported(traceId: string): Promise<boolean> {
      const response = await fetch(`${echoHostUrl}/exported-traces`);
      const bodies = (await response.json()) as string[];
      return bodies.some((body) => body.includes(traceId));
    }

    /** Waits until Kong exported the trace; false after EXPORT_WAIT_MS */
    async function waitForExport(traceId: string): Promise<boolean> {
      const deadline = Date.now() + EXPORT_WAIT_MS;
      while (Date.now() < deadline) {
        if (await exported(traceId)) {
          return true;
        }
        await sleep(250);
      }
      return false;
    }

    beforeAll(
      async () => {
        removeStaleDockerResources(RESOURCE_BASE);
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'otel-e2e-test-'));

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
        const echoPort = await getContainerHostPort(echoName, 3000);
        echoHostUrl = `http://127.0.0.1:${echoPort}`;
        await waitForHttpOk(`${echoHostUrl}/exported-traces`, echo);

        kong = startAttachedContainer(kongName, [
          '--network',
          network,
          '-p',
          '127.0.0.1::8080',
          '-p',
          '127.0.0.1::8100',
          '-e',
          `KONG_TRUST_TOKEN=${TRUST_TOKEN}`,
          '-e',
          `KONG_FRONTEND_TOKEN=${FRONTEND_TOKEN}`,
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
      BUILD_TIMEOUT_MS + START_TIMEOUT_MS * 2,
    );

    afterAll(async () => {
      await stopAttachedContainer(kongName, kong);
      await stopAttachedContainer(echoName, echo);
      spawnSync('docker', ['network', 'rm', network], { stdio: 'ignore' });
      spawnSync('docker', ['rmi', '-f', image], { stdio: 'ignore' });
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }, 120_000);

    describe('frontend traces', () => {
      it(
        'should keep a trace the frontend sampled, whatever the rate',
        async () => {
          const traceId = newTraceId();

          const backend = await send(fromFrontend(traceparent(traceId, true)));

          expect(backend).toEqual({ traceId, flags: '01' });
          expect(await waitForExport(traceId)).toBe(true);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should drop a trace the frontend did not sample',
        async () => {
          const dropped = newTraceId();
          const kept = newTraceId();

          const backend = await send(fromFrontend(traceparent(dropped, false)));
          // A kept trace sent after it, to know Kong's export has caught up
          await send(fromFrontend(traceparent(kept, true)));

          expect(backend).toEqual({ traceId: dropped, flags: '00' });
          expect(await waitForExport(kept)).toBe(true);
          // Two nginx workers export separately: give the other one time
          await sleep(3_000);
          expect(await exported(dropped)).toBe(false);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        "should ignore a traceparent Kong's own reader rejects",
        async () => {
          const invalid = [
            // Trace ID all zeros
            `00-${'0'.repeat(32)}-${PARENT_SPAN_ID}-01`,
            // Parent ID all zeros
            `00-${newTraceId()}-${'0'.repeat(16)}-01`,
            // Unknown version
            `01-${newTraceId()}-${PARENT_SPAN_ID}-01`,
            // Flags not two digits
            `00-${newTraceId()}-${PARENT_SPAN_ID}-001`,
          ];

          for (const parent of invalid) {
            const backend = await send(fromFrontend(parent));
            // Kong starts its own trace, at rate 0
            expect(backend.traceId).not.toBe(parent.split('-')[1]);
            expect(backend.flags).toBe('00');
          }
        },
        TEST_TIMEOUT_MS,
      );
    });

    describe('traceparent copy (X-Tsdevstack-Traceparent)', () => {
      it(
        'should send the services a copy of the traceparent Kong passes on',
        async () => {
          for (const headers of [
            fromFrontend(traceparent(newTraceId(), true)),
            fromFrontend(traceparent(newTraceId(), false)),
            {},
          ]) {
            const backend = await sendRaw(headers);

            expect(backend.traceparent).toMatch(
              /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/,
            );
            expect(backend.copy).toBe(backend.traceparent);
          }
        },
        TEST_TIMEOUT_MS,
      );

      it(
        "should keep the frontend's sampled trace when a platform rewrote its traceparent",
        async () => {
          const traceId = newTraceId();

          const backend = await send({
            ...fromFrontend(traceparent(traceId, false, PLATFORM_SPAN_ID)),
            [KONG_TRACEPARENT_COPY_HEADER]: traceparent(traceId, true),
          });

          expect(backend).toEqual({ traceId, flags: '01' });
          expect(await waitForExport(traceId)).toBe(true);
        },
        TEST_TIMEOUT_MS,
      );

      it(
        "should drop the frontend's unsampled trace when a platform rewrote its traceparent as sampled",
        async () => {
          const traceId = newTraceId();

          const backend = await send({
            ...fromFrontend(traceparent(traceId, true, PLATFORM_SPAN_ID)),
            [KONG_TRACEPARENT_COPY_HEADER]: traceparent(traceId, false),
          });

          expect(backend).toEqual({ traceId, flags: '00' });
        },
        TEST_TIMEOUT_MS,
      );

      it(
        "should not let an outside client's copy force sampling or reach the services",
        async () => {
          const traceId = newTraceId();
          const forged = traceparent(traceId, true);

          // No frontend token: tsdevstack-client-ip drops the copy too
          const backend = await sendRaw({
            [KONG_TRACEPARENT_COPY_HEADER]: forged,
          });

          expect(backend.traceparent).not.toContain(traceId);
          expect(backend.traceparent).toMatch(/-00$/);
          expect(backend.copy).toBe(backend.traceparent);
        },
        TEST_TIMEOUT_MS,
      );
    });

    describe('other requests', () => {
      it(
        'should keep no request without a parent at rate 0',
        async () => {
          const backend = await send({});

          expect(backend.traceId).toMatch(/^[0-9a-f]{32}$/);
          expect(backend.flags).toBe('00');
        },
        TEST_TIMEOUT_MS,
      );

      it(
        'should not let an outside client force sampling',
        async () => {
          const traceId = newTraceId();

          // No frontend token: tsdevstack-client-ip drops the trace headers
          const backend = await send({
            traceparent: traceparent(traceId, true),
          });

          expect(backend.traceId).not.toBe(traceId);
          expect(backend.flags).toBe('00');
        },
        TEST_TIMEOUT_MS,
      );
    });

    it('should log no errors', () => {
      expect(kong!.logs.join('')).not.toContain('[error]');
    });
  },
);
