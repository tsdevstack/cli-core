import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import * as inquirerModule from 'inquirer';
import * as loggerModule from '../utils/logger';
import * as configModule from '../utils/config';
import { unregisterDetachedWorker } from './unregister-detached-worker';
import type { FrameworkConfig } from '../utils/config';
import { CliError } from '../utils/errors';

rs.mock('inquirer', { mock: true });
rs.mock('../utils/logger', { mock: true });
rs.mock('../utils/config', { mock: true });

describe('unregisterDetachedWorker', () => {
  const mockLogger = {
    newline: rs.fn(),
    info: rs.fn(),
    warn: rs.fn(),
    success: rs.fn(),
  };

  const mockConfigWithWorkers: FrameworkConfig = {
    project: { name: 'test-project', version: '1.0.0' },
    cloud: { provider: null },
    services: [
      { name: 'auth-service', type: 'nestjs', port: 3001 },
      { name: 'auth-worker', type: 'worker', baseService: 'auth-service' },
      { name: 'user-worker', type: 'worker', baseService: 'auth-service' },
    ],
  };

  const mockConfigNoWorkers: FrameworkConfig = {
    project: { name: 'test-project', version: '1.0.0' },
    cloud: { provider: null },
    services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
  };

  beforeEach(() => {
    rs.clearAllMocks();

    rs.mocked(loggerModule.logger).newline = mockLogger.newline;
    rs.mocked(loggerModule.logger).info = mockLogger.info;
    rs.mocked(loggerModule.logger).warn = mockLogger.warn;
    rs.mocked(loggerModule.logger).success = mockLogger.success;

    rs.mocked(configModule.loadFrameworkConfig).mockReturnValue(
      mockConfigWithWorkers,
    );
  });

  describe('No workers', () => {
    it('should throw CliError when no workers exist', async () => {
      rs.mocked(configModule.loadFrameworkConfig).mockReturnValue(
        mockConfigNoWorkers,
      );

      await expect(unregisterDetachedWorker({})).rejects.toThrow(CliError);
    });
  });

  describe('Worker selection', () => {
    it('should prompt for worker when not provided', async () => {
      rs.mocked(inquirerModule.default.prompt).mockResolvedValue({
        selectedWorker: 'auth-worker',
      });
      // Second prompt for confirmation
      rs.mocked(inquirerModule.default.prompt)
        .mockResolvedValueOnce({ selectedWorker: 'auth-worker' })
        .mockResolvedValueOnce({ confirmed: true });

      await unregisterDetachedWorker({});

      const firstCall = rs.mocked(inquirerModule.default.prompt).mock.calls[0];
      const firstQuestion = (
        firstCall[0] as unknown as Array<Record<string, unknown>>
      )[0];
      expect(firstQuestion.type).toBe('list');
      expect(firstQuestion.name).toBe('selectedWorker');
    });

    it('should use provided worker name', async () => {
      rs.mocked(inquirerModule.default.prompt).mockResolvedValue({
        confirmed: true,
      });

      await unregisterDetachedWorker({ worker: 'auth-worker' });

      // Should only prompt for confirmation, not for worker selection
      expect(inquirerModule.default.prompt).toHaveBeenCalledTimes(1);
    });
  });

  describe('Validation', () => {
    it('should throw CliError when specified worker not found', async () => {
      await expect(
        unregisterDetachedWorker({ worker: 'nonexistent-worker' }),
      ).rejects.toThrow(CliError);
    });

    it('should throw when name matches a non-worker service', async () => {
      await expect(
        unregisterDetachedWorker({ worker: 'auth-service' }),
      ).rejects.toThrow(CliError);
    });
  });

  describe('Confirmation', () => {
    it('should abort when user declines confirmation', async () => {
      rs.mocked(inquirerModule.default.prompt).mockResolvedValue({
        confirmed: false,
      });

      await unregisterDetachedWorker({ worker: 'auth-worker' });

      expect(configModule.saveFrameworkConfig).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Aborted.');
    });
  });

  describe('Successful unregistration', () => {
    it('should remove worker from config and save', async () => {
      rs.mocked(inquirerModule.default.prompt).mockResolvedValue({
        confirmed: true,
      });

      await unregisterDetachedWorker({ worker: 'auth-worker' });

      expect(configModule.saveFrameworkConfig).toHaveBeenCalledTimes(1);
      const savedConfig = rs.mocked(configModule.saveFrameworkConfig).mock
        .calls[0][0];
      const serviceNames = savedConfig.services.map(
        (s: { name: string }) => s.name,
      );
      expect(serviceNames).not.toContain('auth-worker');
      expect(serviceNames).toContain('auth-service');
      expect(serviceNames).toContain('user-worker');
    });

    it('should log success message', async () => {
      rs.mocked(inquirerModule.default.prompt).mockResolvedValue({
        confirmed: true,
      });

      await unregisterDetachedWorker({ worker: 'auth-worker' });

      expect(mockLogger.success).toHaveBeenCalledWith(
        'Unregistered worker: auth-worker',
      );
    });

    it('should show cloud resource warning', async () => {
      rs.mocked(inquirerModule.default.prompt).mockResolvedValue({
        confirmed: true,
      });

      await unregisterDetachedWorker({ worker: 'auth-worker' });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'IMPORTANT: This only removes the worker from framework config.',
      );
    });
  });
});
