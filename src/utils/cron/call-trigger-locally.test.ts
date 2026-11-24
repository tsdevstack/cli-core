import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';

rs.mock('../logger', { mock: true });

import { logger } from '../logger';
import { callTriggerLocally } from './call-trigger-locally';
import { CliError } from '../errors';

const services = [
  { name: 'auth-service', port: 3001 },
  { name: 'auth-worker' },
];

const trigger = {
  name: 'cleanup-tokens',
  targetService: 'auth-service',
  endpoint: '/auth/jobs/cleanup-tokens',
  method: 'POST',
  httpTimeout: 30,
};

function fakeResponse(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('callTriggerLocally', () => {
  let fetchSpy: ReturnType<typeof rs.spyOn>;

  beforeEach(() => {
    rs.resetAllMocks();
    process.exitCode = undefined;
    fetchSpy = rs
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(fakeResponse(200, '{"success":true}'));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    process.exitCode = undefined;
  });

  describe('Standard use cases', () => {
    it("should call the endpoint on the service's local port with the entry's method", async () => {
      await callTriggerLocally(services, 'cleanup-tokens', 'dev', trigger);

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3001/auth/jobs/cleanup-tokens',
        expect.objectContaining({
          method: 'POST',
          signal: expect.any(AbortSignal),
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Calling trigger "cleanup-tokens" (dev) locally: POST http://localhost:3001/auth/jobs/cleanup-tokens',
      );
      expect(logger.success).toHaveBeenCalledWith('200 OK');
      expect(logger.info).toHaveBeenCalledWith('{"success":true}');
      expect(process.exitCode).toBeUndefined();
    });

    it('should default the method to POST', async () => {
      await callTriggerLocally(services, 'cleanup-tokens', 'dev', {
        name: trigger.name,
        targetService: trigger.targetService,
        endpoint: trigger.endpoint,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should report a failed response with exit code 1', async () => {
      fetchSpy.mockResolvedValue(fakeResponse(500, 'boom'));

      await callTriggerLocally(services, 'cleanup-tokens', 'dev', trigger);

      expect(logger.error).toHaveBeenCalledWith('500 Error');
      expect(logger.info).toHaveBeenCalledWith('boom');
      expect(process.exitCode).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('should explain when the service is not reachable', async () => {
      fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        callTriggerLocally(services, 'cleanup-tokens', 'dev', trigger),
      ).rejects.toThrow(CliError);
      await expect(
        callTriggerLocally(services, 'cleanup-tokens', 'dev', trigger),
      ).rejects.toThrow(
        'Could not reach http://localhost:3001/auth/jobs/cleanup-tokens: ECONNREFUSED',
      );
    });

    it('should throw when the target service has no local port', async () => {
      await expect(
        callTriggerLocally(services, 'cleanup-tokens', 'dev', {
          ...trigger,
          targetService: 'auth-worker',
        }),
      ).rejects.toThrow(
        'targets "auth-worker", which has no local port in config.json',
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should throw when the entry has no endpoint', async () => {
      await expect(
        callTriggerLocally(services, 'cleanup-tokens', 'dev', {
          name: 'cleanup-tokens',
          targetService: 'auth-service',
        }),
      ).rejects.toThrow('Trigger "cleanup-tokens" (dev) has no endpoint');
    });
  });
});
