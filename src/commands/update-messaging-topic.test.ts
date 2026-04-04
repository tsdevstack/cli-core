import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import {
  loadFrameworkConfig,
  saveFrameworkConfig,
  getNestjsServiceNames,
} from '../utils/config';
import { sync } from './sync';
import { updateMessagingTopic } from './update-messaging-topic';
import type { FrameworkConfig } from '../utils/config';
import { CliError } from '../utils/errors';

rs.mock('inquirer', { mock: true });
rs.mock('../utils/logger', { mock: true });
rs.mock('../utils/config', { mock: true });
rs.mock('./sync', { mock: true });

describe('updateMessagingTopic', () => {
  const mockConfig: FrameworkConfig = {
    project: { name: 'test', version: '1.0.0' },
    cloud: { provider: null },
    services: [
      { name: 'auth-service', type: 'nestjs', port: 3001 },
      { name: 'offers-service', type: 'nestjs', port: 3002 },
      { name: 'notifications-service', type: 'nestjs', port: 3004 },
    ],
    messaging: {
      topics: [
        {
          name: 'user-created',
          publishers: ['auth-service'],
          subscribers: ['offers-service'],
        },
      ],
    },
  };

  beforeEach(() => {
    rs.resetAllMocks();
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
    rs.mocked(getNestjsServiceNames).mockReturnValue([
      'auth-service',
      'offers-service',
      'notifications-service',
    ]);
  });

  describe('no topics', () => {
    it('should throw when no topics exist', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue({
        ...mockConfig,
        messaging: undefined,
      });

      await expect(updateMessagingTopic({})).rejects.toThrow(CliError);
    });
  });

  describe('topic resolution', () => {
    it('should throw when topic not found', async () => {
      await expect(
        updateMessagingTopic({
          name: 'nonexistent',
          publishers: '',
          subscribers: '',
        }),
      ).rejects.toThrow(CliError);
      expect(saveFrameworkConfig).not.toHaveBeenCalled();
    });

    it('should prompt for topic selection when name not provided', async () => {
      rs.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ selectedTopic: 'user-created' })
        .mockResolvedValueOnce({ publishers: ['auth-service'] })
        .mockResolvedValueOnce({ subscribers: ['offers-service'] });

      await updateMessagingTopic({});

      const firstCall = rs.mocked(inquirer.prompt).mock.calls[0];
      const firstQuestion = (
        firstCall[0] as unknown as Array<Record<string, unknown>>
      )[0];
      expect(firstQuestion.type).toBe('list');
    });
  });

  describe('replace semantics', () => {
    it('should replace publishers entirely', async () => {
      await updateMessagingTopic({
        name: 'user-created',
        publishers: 'offers-service',
        subscribers: 'offers-service',
      });

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.messaging?.topics[0].publishers).toEqual([
        'offers-service',
      ]);
    });

    it('should replace subscribers entirely', async () => {
      await updateMessagingTopic({
        name: 'user-created',
        publishers: 'auth-service',
        subscribers: 'auth-service,notifications-service',
      });

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.messaging?.topics[0].subscribers).toEqual([
        'auth-service',
        'notifications-service',
      ]);
    });

    it('should allow clearing publishers and subscribers', async () => {
      await updateMessagingTopic({
        name: 'user-created',
        publishers: '',
        subscribers: '',
      });

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.messaging?.topics[0].publishers).toEqual([]);
      expect(savedConfig.messaging?.topics[0].subscribers).toEqual([]);
    });
  });

  describe('service validation', () => {
    it('should reject non-NestJS service as publisher', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue({
        ...mockConfig,
        services: [
          ...mockConfig.services,
          { name: 'frontend', type: 'nextjs', port: 3000 },
        ],
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
      rs.mocked(getNestjsServiceNames).mockReturnValue([
        'auth-service',
        'offers-service',
        'notifications-service',
      ]);

      await expect(
        updateMessagingTopic({
          name: 'user-created',
          publishers: 'frontend',
          subscribers: 'offers-service',
        }),
      ).rejects.toThrow('not a valid NestJS service');
    });
  });

  describe('interactive mode', () => {
    it('should pre-check current selections in checkbox', async () => {
      rs.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ selectedTopic: 'user-created' })
        .mockResolvedValueOnce({ publishers: ['auth-service'] })
        .mockResolvedValueOnce({
          subscribers: ['offers-service', 'notifications-service'],
        });

      await updateMessagingTopic({});

      // Check publishers prompt (second call) has pre-checked values
      const pubCall = rs.mocked(inquirer.prompt).mock.calls[1];
      const pubQuestion = (
        pubCall[0] as unknown as Array<Record<string, unknown>>
      )[0];
      const choices = pubQuestion.choices as Array<{
        name: string;
        checked: boolean;
      }>;
      const authChoice = choices.find((c) => c.name === 'auth-service');
      const offersChoice = choices.find((c) => c.name === 'offers-service');
      expect(authChoice?.checked).toBe(true);
      expect(offersChoice?.checked).toBe(false);
    });
  });

  describe('sync', () => {
    it('should call sync after update', async () => {
      await updateMessagingTopic({
        name: 'user-created',
        publishers: 'auth-service',
        subscribers: 'offers-service',
      });

      expect(sync).toHaveBeenCalledTimes(1);
    });

    it('should handle sync failure gracefully', async () => {
      rs.mocked(sync).mockImplementation(() => {
        throw new Error('Sync failed');
      });

      await updateMessagingTopic({
        name: 'user-created',
        publishers: 'auth-service',
        subscribers: 'offers-service',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Sync failed'),
      );
    });
  });
});
