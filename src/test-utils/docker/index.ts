/**
 * Helpers for Docker-backed tests (*.docker.test.ts). Not part of the
 * published test-utils entry.
 */

export type { RunningContainer } from './types';
export { sleep } from './sleep';
export { runDocker } from './run-docker';
export { isDockerAvailable } from './is-docker-available';
export { startAttachedContainer } from './start-attached-container';
export { getContainerHostPort } from './get-container-host-port';
export { waitForHttpOk } from './wait-for-http-ok';
export { stopAttachedContainer } from './stop-attached-container';
export {
  startRedisContainer,
  type StartRedisContainerOptions,
  type StartedRedisContainer,
} from './start-redis-container';
