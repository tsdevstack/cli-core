import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import {
  loadFrameworkConfig,
  saveFrameworkConfig,
  getNestjsServiceNames,
} from '../utils/config';
import { validateTopicName } from '../utils/validation/validate-topic-name';
import { sync } from './sync';
import { addMessagingTopic } from './add-messaging-topic';
import type { FrameworkConfig } from '../utils/config';
import { CliError } from '../utils/errors';

rs.mock('inquirer', { mock: true });
rs.mock('../utils/logger', { mock: true });
rs.mock('../utils/config', { mock: true });
rs.mock('../utils/validation/validate-topic-name', { mock: true });
rs.mock('./sync', { mock: true });

describe('addMessagingTopic', () => {
  const mockConfig: FrameworkConfig = {
    project: { name: 'test', version: '1.0.0' },
    cloud: { provider: null },
    services: [
      { name: 'auth-service', type: 'nestjs', port: 3001 },
      { name: 'offers-service', type: 'nestjs', port: 3002 },
      { name: 'frontend', type: 'nextjs', port: 3000 },
      { name: 'auth-worker', type: 'worker' },
    ],
  };

  beforeEach(() => {
    rs.resetAllMocks();
    rs.mocked(loadFrameworkConfig).mockReturnValue({ ...mockConfig });
    rs.mocked(getNestjsServiceNames).mockReturnValue([
      'auth-service',
      'offers-service',
    ]);
  });

  describe('with --name flag', () => {
    it('should validate and add topic to config', async () => {
      await addMessagingTopic({
        name: 'user-created',
        publishers: 'auth-service',
        subscribers: 'offers-service',
      });

      expect(validateTopicName).toHaveBeenCalledWith(
        'user-created',
        expect.any(Object),
      );
      expect(saveFrameworkConfig).toHaveBeenCalledTimes(1);

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.messaging).toEqual({
        topics: [
          {
            name: 'user-created',
            publishers: ['auth-service'],
            subscribers: ['offers-service'],
          },
        ],
      });
    });

    it('should throw when validation fails', async () => {
      rs.mocked(validateTopicName).mockImplementation(() => {
        throw new Error('Invalid name');
      });

      await expect(
        addMessagingTopic({ name: 'bad!', publishers: '', subscribers: '' }),
      ).rejects.toThrow('Invalid name');
      expect(saveFrameworkConfig).not.toHaveBeenCalled();
    });
  });

  describe('service validation', () => {
    it('should throw when no NestJS services exist', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue({
        ...mockConfig,
        services: [{ name: 'frontend', type: 'nextjs', port: 3000 }],
      });
      rs.mocked(getNestjsServiceNames).mockReturnValue([]);

      await expect(
        addMessagingTopic({ name: 'test', publishers: '', subscribers: '' }),
      ).rejects.toThrow(CliError);
    });

    it('should reject non-NestJS service as publisher', async () => {
      await expect(
        addMessagingTopic({
          name: 'test',
          publishers: 'frontend',
          subscribers: '',
        }),
      ).rejects.toThrow('not a valid NestJS service');
    });

    it('should reject non-NestJS service as subscriber', async () => {
      await expect(
        addMessagingTopic({
          name: 'test',
          publishers: '',
          subscribers: 'auth-worker',
        }),
      ).rejects.toThrow('not a valid NestJS service');
    });

    it('should accept multiple publishers and subscribers', async () => {
      await addMessagingTopic({
        name: 'user-created',
        publishers: 'auth-service,offers-service',
        subscribers: 'auth-service,offers-service',
      });

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.messaging?.topics[0].publishers).toEqual([
        'auth-service',
        'offers-service',
      ]);
      expect(savedConfig.messaging?.topics[0].subscribers).toEqual([
        'auth-service',
        'offers-service',
      ]);
    });

    it('should allow empty publishers and subscribers', async () => {
      await addMessagingTopic({
        name: 'user-created',
        publishers: '',
        subscribers: '',
      });

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.messaging?.topics[0].publishers).toEqual([]);
      expect(savedConfig.messaging?.topics[0].subscribers).toEqual([]);
    });
  });

  describe('interactive mode', () => {
    it('should prompt for name when not provided', async () => {
      rs.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ name: 'user-created' })
        .mockResolvedValueOnce({ publishers: ['auth-service'] })
        .mockResolvedValueOnce({ subscribers: ['offers-service'] });

      await addMessagingTopic({});

      const firstCall = rs.mocked(inquirer.prompt).mock.calls[0];
      const firstQuestion = (
        firstCall[0] as unknown as Array<Record<string, unknown>>
      )[0];
      expect(firstQuestion.type).toBe('input');
      expect(firstQuestion.message).toContain('Topic name');
    });

    it('should show only NestJS services in checkbox', async () => {
      rs.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ name: 'test-topic' })
        .mockResolvedValueOnce({ publishers: [] })
        .mockResolvedValueOnce({ subscribers: [] });

      await addMessagingTopic({});

      // Check publishers prompt (second call)
      const pubCall = rs.mocked(inquirer.prompt).mock.calls[1];
      const pubQuestion = (
        pubCall[0] as unknown as Array<Record<string, unknown>>
      )[0];
      const choices = pubQuestion.choices as Array<{ name: string }>;
      const choiceNames = choices.map((c) => c.name);
      expect(choiceNames).toContain('auth-service');
      expect(choiceNames).toContain('offers-service');
      expect(choiceNames).not.toContain('frontend');
      expect(choiceNames).not.toContain('auth-worker');
    });
  });

  describe('config update', () => {
    it('should create messaging key when first topic', async () => {
      await addMessagingTopic({
        name: 'user-created',
        publishers: 'auth-service',
        subscribers: 'offers-service',
      });

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.messaging).toBeDefined();
      expect(savedConfig.messaging?.topics).toHaveLength(1);
    });

    it('should append to existing topics', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue({
        ...mockConfig,
        messaging: {
          topics: [
            {
              name: 'existing-topic',
              publishers: ['auth-service'],
              subscribers: ['offers-service'],
            },
          ],
        },
      });

      await addMessagingTopic({
        name: 'new-topic',
        publishers: 'offers-service',
        subscribers: 'auth-service',
      });

      const savedConfig = rs.mocked(saveFrameworkConfig).mock.calls[0][0];
      expect(savedConfig.messaging?.topics).toHaveLength(2);
      expect(savedConfig.messaging?.topics[1].name).toBe('new-topic');
    });
  });

  describe('sync', () => {
    it('should call sync after config update', async () => {
      await addMessagingTopic({
        name: 'user-created',
        publishers: 'auth-service',
        subscribers: '',
      });

      expect(sync).toHaveBeenCalledTimes(1);
    });

    it('should handle sync failure gracefully', async () => {
      rs.mocked(sync).mockImplementation(() => {
        throw new Error('Sync failed');
      });

      await addMessagingTopic({
        name: 'user-created',
        publishers: '',
        subscribers: '',
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Sync failed'),
      );
    });
  });
});
