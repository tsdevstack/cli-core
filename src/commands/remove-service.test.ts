import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import inquirer from 'inquirer';
import fs from 'node:fs';
import { logger } from '../utils/logger';
import { loadFrameworkConfig, saveFrameworkConfig } from '../utils/config';
import { findProjectRoot } from '../utils/paths';
import { sync } from './sync';
import { removeService } from './remove-service';
import type { FrameworkConfig } from '../utils/config';
import { CliError } from '../utils/errors';

rs.mock('node:fs', { mock: true });
rs.mock('inquirer', { mock: true });
rs.mock('../utils/logger', { mock: true });
rs.mock('../utils/config', { mock: true });
rs.mock('../utils/paths', { mock: true });
rs.mock('./sync', { mock: true });

describe('removeService', () => {
  const mockConfig: FrameworkConfig = {
    project: { name: 'test-project', version: '1.0.0' },
    cloud: { provider: null },
    services: [
      { name: 'auth-service', type: 'nestjs', port: 3001 },
      { name: 'user-service', type: 'nestjs', port: 3002 },
      { name: 'auth-worker', type: 'worker', baseService: 'auth-service' },
    ],
  };

  beforeEach(() => {
    rs.resetAllMocks();

    rs.mocked(findProjectRoot).mockReturnValue('/mock/project');
    rs.mocked(loadFrameworkConfig).mockReturnValue(mockConfig);
    rs.mocked(fs.existsSync).mockReturnValue(false);
  });

  describe('Service resolution', () => {
    it('should use provided service name', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValue({ confirmed: true });

      await removeService('auth-service', { dryRun: true });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('auth-service'),
      );
    });

    it('should throw when no services in config', async () => {
      const emptyConfig = { ...mockConfig, services: [] };
      rs.mocked(loadFrameworkConfig).mockReturnValue(emptyConfig);

      await expect(removeService(undefined, {})).rejects.toThrow(CliError);
    });

    it('should prompt for selection when name not provided', async () => {
      rs.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ selectedService: 'auth-service' })
        .mockResolvedValueOnce({ confirmed: true });

      await removeService(undefined, { dryRun: true });

      const firstCall = rs.mocked(inquirer.prompt).mock.calls[0];
      const firstQuestion = (
        firstCall[0] as unknown as Array<Record<string, unknown>>
      )[0];
      expect(firstQuestion.type).toBe('list');
    });

    it('should filter out coupled workers from selection list', async () => {
      rs.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ selectedService: 'auth-service' })
        .mockResolvedValueOnce({ confirmed: true });

      await removeService(undefined, { dryRun: true });

      const firstCall = rs.mocked(inquirer.prompt).mock.calls[0];
      const firstQuestion = (
        firstCall[0] as unknown as Array<Record<string, unknown>>
      )[0];
      const choices = firstQuestion.choices as Array<{ value: string }>;
      const values = choices.map((c) => c.value);
      expect(values).not.toContain('auth-worker');
    });

    it('should throw when service not found', async () => {
      await expect(removeService('nonexistent-service', {})).rejects.toThrow(
        CliError,
      );
    });
  });

  describe('Coupled workers', () => {
    it('should identify coupled workers for the service being removed', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValue({ confirmed: true });

      await removeService('auth-service', { dryRun: true });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('auth-worker'),
      );
    });
  });

  describe('Dry run', () => {
    it('should log and return without deleting in dry run mode', async () => {
      await removeService('auth-service', { dryRun: true });

      expect(logger.info).toHaveBeenCalledWith(
        'Dry run complete. No files were deleted.',
      );
      expect(fs.rmSync).not.toHaveBeenCalled();
      expect(saveFrameworkConfig).not.toHaveBeenCalled();
    });
  });

  describe('Confirmation', () => {
    it('should abort when user declines', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValue({ confirmed: false });

      await removeService('auth-service', {});

      expect(fs.rmSync).not.toHaveBeenCalled();
      expect(saveFrameworkConfig).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Aborted.');
    });
  });

  describe('Deletion', () => {
    it('should delete existing directories', async () => {
      rs.mocked(fs.existsSync).mockReturnValue(true);
      rs.mocked(fs.readFileSync).mockReturnValue('{}');
      rs.mocked(inquirer.prompt).mockResolvedValue({ confirmed: true });

      await removeService('user-service', {});

      expect(fs.rmSync).toHaveBeenCalled();
    });

    it('should not delete non-existing directories', async () => {
      rs.mocked(fs.existsSync).mockReturnValue(false);
      rs.mocked(inquirer.prompt).mockResolvedValue({ confirmed: true });

      await removeService('user-service', {});

      expect(fs.rmSync).not.toHaveBeenCalled();
    });

    it('should remove service and coupled workers from config', async () => {
      rs.mocked(fs.existsSync).mockReturnValue(false);
      rs.mocked(inquirer.prompt).mockResolvedValue({ confirmed: true });

      await removeService('auth-service', {});

      expect(saveFrameworkConfig).toHaveBeenCalledTimes(1);
      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      const names = savedConfig.services.map((s: { name: string }) => s.name);
      expect(names).not.toContain('auth-service');
      expect(names).not.toContain('auth-worker');
      expect(names).toContain('user-service');
    });
  });

  describe('Sync', () => {
    it('should call sync with remove context after removal', async () => {
      rs.mocked(fs.existsSync).mockReturnValue(false);
      rs.mocked(inquirer.prompt).mockResolvedValue({ confirmed: true });

      await removeService('user-service', {});

      expect(sync).toHaveBeenCalledTimes(1);
      expect(sync).toHaveBeenCalledWith({
        operation: 'remove',
        removedService: 'user-service',
      });
    });

    it('should handle sync failure gracefully', async () => {
      rs.mocked(fs.existsSync).mockReturnValue(false);
      rs.mocked(inquirer.prompt).mockResolvedValue({ confirmed: true });
      rs.mocked(sync).mockImplementation(() => {
        throw new Error('Sync failed');
      });

      await removeService('user-service', {});

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Sync failed'),
      );
    });
  });
});
