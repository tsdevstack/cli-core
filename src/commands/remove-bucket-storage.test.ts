import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { loadFrameworkConfig, saveFrameworkConfig } from '../utils/config';
import { sync } from './sync';
import { removeBucketStorage } from './remove-bucket-storage';
import type { FrameworkConfig } from '../utils/config';
import { CliError } from '../utils/errors';

rs.mock('inquirer', { mock: true });
rs.mock('../utils/logger', { mock: true });
rs.mock('../utils/config', { mock: true });
rs.mock('./sync', { mock: true });

describe('removeBucketStorage', () => {
  const mockConfig: FrameworkConfig = {
    project: { name: 'test', version: '1.0.0' },
    cloud: { provider: null },
    services: [],
    storage: { buckets: ['uploads', 'media'] },
  };

  beforeEach(() => {
    rs.resetAllMocks();
    rs.mocked(loadFrameworkConfig).mockReturnValue({
      ...mockConfig,
      storage: { buckets: [...mockConfig.storage!.buckets] },
    });
  });

  describe('no buckets', () => {
    it('should throw when no buckets exist', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue({
        ...mockConfig,
        storage: undefined,
      });

      await expect(removeBucketStorage({})).rejects.toThrow(CliError);
    });

    it('should throw when buckets array is empty', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue({
        ...mockConfig,
        storage: { buckets: [] },
      });

      await expect(removeBucketStorage({})).rejects.toThrow(CliError);
    });
  });

  describe('bucket resolution', () => {
    it('should use provided bucket name with --force', async () => {
      await removeBucketStorage({ name: 'uploads', force: true });

      expect(saveFrameworkConfig).toHaveBeenCalledTimes(1);
      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.storage).toEqual({ buckets: ['media'] });
    });

    it('should prompt for selection when name not provided', async () => {
      rs.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ selectedBucket: 'uploads' })
        .mockResolvedValueOnce({ confirmed: true });

      await removeBucketStorage({});

      const firstCall = rs.mocked(inquirer.prompt).mock.calls[0];
      const firstQuestion = (
        firstCall[0] as unknown as Array<Record<string, unknown>>
      )[0];
      expect(firstQuestion.type).toBe('list');
    });

    it('should throw when bucket not found', async () => {
      await expect(
        removeBucketStorage({ name: 'nonexistent', force: true }),
      ).rejects.toThrow(CliError);
      expect(saveFrameworkConfig).not.toHaveBeenCalled();
    });
  });

  describe('confirmation', () => {
    it('should abort when user declines', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValue({ confirmed: false });

      await removeBucketStorage({ name: 'uploads' });

      expect(saveFrameworkConfig).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Aborted.');
    });

    it('should skip confirmation with --force', async () => {
      await removeBucketStorage({ name: 'uploads', force: true });

      expect(saveFrameworkConfig).toHaveBeenCalledTimes(1);
      // inquirer.prompt should not be called at all with --force
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });
  });

  describe('config update', () => {
    it('should remove bucket from config', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValue({ confirmed: true });

      await removeBucketStorage({ name: 'uploads' });

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.storage).toEqual({ buckets: ['media'] });
    });

    it('should delete storage key when last bucket removed', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue({
        ...mockConfig,
        storage: { buckets: ['uploads'] },
      });

      await removeBucketStorage({ name: 'uploads', force: true });

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.storage).toBeUndefined();
    });
  });

  describe('sync', () => {
    it('should call sync after removal', async () => {
      await removeBucketStorage({ name: 'uploads', force: true });

      expect(sync).toHaveBeenCalledTimes(1);
    });

    it('should handle sync failure gracefully', async () => {
      rs.mocked(sync).mockImplementation(() => {
        throw new Error('Sync failed');
      });

      await removeBucketStorage({ name: 'uploads', force: true });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Sync failed'),
      );
    });
  });
});
