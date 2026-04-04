import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { loadFrameworkConfig, saveFrameworkConfig } from '../utils/config';
import { validateBucketName } from '../utils/validation/validate-bucket-name';
import { sync } from './sync';
import { addBucketStorage } from './add-bucket-storage';
import type { FrameworkConfig } from '../utils/config';

rs.mock('inquirer', { mock: true });
rs.mock('../utils/logger', { mock: true });
rs.mock('../utils/config', { mock: true });
rs.mock('../utils/validation/validate-bucket-name', { mock: true });
rs.mock('./sync', { mock: true });

describe('addBucketStorage', () => {
  const mockConfig: FrameworkConfig = {
    project: { name: 'test', version: '1.0.0' },
    cloud: { provider: null },
    services: [],
  };

  beforeEach(() => {
    rs.resetAllMocks();
    rs.mocked(loadFrameworkConfig).mockReturnValue({ ...mockConfig });
  });

  describe('with --name flag', () => {
    it('should validate and add bucket to config', async () => {
      await addBucketStorage({ name: 'uploads' });

      expect(validateBucketName).toHaveBeenCalledWith(
        'uploads',
        expect.any(Object),
      );
      expect(saveFrameworkConfig).toHaveBeenCalledTimes(1);

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.storage).toEqual({ buckets: ['uploads'] });
    });

    it('should throw when validation fails', async () => {
      rs.mocked(validateBucketName).mockImplementation(() => {
        throw new Error('Invalid name');
      });

      await expect(addBucketStorage({ name: 'bad!' })).rejects.toThrow(
        'Invalid name',
      );
      expect(saveFrameworkConfig).not.toHaveBeenCalled();
    });
  });

  describe('interactive mode', () => {
    it('should prompt for name when not provided', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValue({ name: 'media' });

      await addBucketStorage({});

      const firstCall = rs.mocked(inquirer.prompt).mock.calls[0];
      const firstQuestion = (
        firstCall[0] as unknown as Array<Record<string, unknown>>
      )[0];
      expect(firstQuestion.type).toBe('input');
      expect(firstQuestion.message).toContain('Bucket name');
    });
  });

  describe('config update', () => {
    it('should create storage key when first bucket', async () => {
      await addBucketStorage({ name: 'uploads' });

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.storage).toEqual({ buckets: ['uploads'] });
    });

    it('should append to existing buckets', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue({
        ...mockConfig,
        storage: { buckets: ['uploads'] },
      });

      await addBucketStorage({ name: 'media' });

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.storage).toEqual({ buckets: ['uploads', 'media'] });
    });
  });

  describe('sync', () => {
    it('should call sync after config update', async () => {
      await addBucketStorage({ name: 'uploads' });

      expect(sync).toHaveBeenCalledTimes(1);
    });

    it('should handle sync failure gracefully', async () => {
      rs.mocked(sync).mockImplementation(() => {
        throw new Error('Sync failed');
      });

      await addBucketStorage({ name: 'uploads' });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Sync failed'),
      );
    });
  });
});
