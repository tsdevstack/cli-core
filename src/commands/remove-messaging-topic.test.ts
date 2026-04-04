import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { loadFrameworkConfig, saveFrameworkConfig } from '../utils/config';
import { sync } from './sync';
import { removeMessagingTopic } from './remove-messaging-topic';
import type { FrameworkConfig } from '../utils/config';
import { CliError } from '../utils/errors';

rs.mock('inquirer', { mock: true });
rs.mock('../utils/logger', { mock: true });
rs.mock('../utils/config', { mock: true });
rs.mock('./sync', { mock: true });

describe('removeMessagingTopic', () => {
  const mockConfig: FrameworkConfig = {
    project: { name: 'test', version: '1.0.0' },
    cloud: { provider: null },
    services: [
      { name: 'auth-service', type: 'nestjs', port: 3001 },
      { name: 'offers-service', type: 'nestjs', port: 3002 },
    ],
    messaging: {
      topics: [
        {
          name: 'user-created',
          publishers: ['auth-service'],
          subscribers: ['offers-service'],
        },
        {
          name: 'offer-accepted',
          publishers: ['offers-service'],
          subscribers: ['auth-service'],
        },
      ],
    },
  };

  beforeEach(() => {
    rs.resetAllMocks();
    rs.mocked(loadFrameworkConfig).mockReturnValue({
      ...mockConfig,
      messaging: {
        topics: [...mockConfig.messaging!.topics],
      },
    });
  });

  describe('no topics', () => {
    it('should throw when no topics exist', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue({
        ...mockConfig,
        messaging: undefined,
      });

      await expect(removeMessagingTopic({})).rejects.toThrow(CliError);
    });

    it('should throw when topics array is empty', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue({
        ...mockConfig,
        messaging: { topics: [] },
      });

      await expect(removeMessagingTopic({})).rejects.toThrow(CliError);
    });
  });

  describe('topic resolution', () => {
    it('should use provided topic name', async () => {
      await removeMessagingTopic({ name: 'user-created' });

      expect(saveFrameworkConfig).toHaveBeenCalledTimes(1);
      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.messaging?.topics).toHaveLength(1);
      expect(savedConfig.messaging?.topics[0].name).toBe('offer-accepted');
    });

    it('should prompt for selection when name not provided', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValueOnce({
        selectedTopic: 'user-created',
      });

      await removeMessagingTopic({});

      const firstCall = rs.mocked(inquirer.prompt).mock.calls[0];
      const firstQuestion = (
        firstCall[0] as unknown as Array<Record<string, unknown>>
      )[0];
      expect(firstQuestion.type).toBe('list');
    });

    it('should throw when topic not found', async () => {
      await expect(
        removeMessagingTopic({ name: 'nonexistent' }),
      ).rejects.toThrow(CliError);
      expect(saveFrameworkConfig).not.toHaveBeenCalled();
    });
  });

  describe('config update', () => {
    it('should remove topic from config', async () => {
      await removeMessagingTopic({ name: 'user-created' });

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.messaging?.topics).toHaveLength(1);
      expect(savedConfig.messaging?.topics[0].name).toBe('offer-accepted');
    });

    it('should delete messaging key when last topic removed', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue({
        ...mockConfig,
        messaging: {
          topics: [
            {
              name: 'user-created',
              publishers: ['auth-service'],
              subscribers: ['offers-service'],
            },
          ],
        },
      });

      await removeMessagingTopic({ name: 'user-created' });

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.messaging).toBeUndefined();
    });
  });

  describe('sync', () => {
    it('should call sync after removal', async () => {
      await removeMessagingTopic({ name: 'user-created' });

      expect(sync).toHaveBeenCalledTimes(1);
    });

    it('should handle sync failure gracefully', async () => {
      rs.mocked(sync).mockImplementation(() => {
        throw new Error('Sync failed');
      });

      await removeMessagingTopic({ name: 'user-created' });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Sync failed'),
      );
    });
  });
});
