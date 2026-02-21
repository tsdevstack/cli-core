/**
 * Tests for addService command
 */

import { describe, it, expect, rs, beforeEach } from '@rstest/core';

// Mock dependencies
rs.mock('inquirer', { mock: true });
rs.mock('../utils/logger', { mock: true });
rs.mock('../utils/config', { mock: true });
rs.mock('../utils/validation', { mock: true });
rs.mock('../utils/validation/validate-service-name', { mock: true });
rs.mock('../utils/add-service/get-next-port', { mock: true });
rs.mock('../utils/add-service/flows/spa-flow', { mock: true });
rs.mock('../utils/add-service/flows/nextjs-flow', { mock: true });
rs.mock('../utils/add-service/flows/nestjs-flow', { mock: true });

import { addService } from './add-service';
import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { loadFrameworkConfig } from '../utils/config';
import { validateServiceNameAvailable } from '../utils/validation';
import { validateServiceName } from '../utils/validation/validate-service-name';
import { getNextPort } from '../utils/add-service/get-next-port';
import { spaFlow } from '../utils/add-service/flows/spa-flow';
import { nextjsFlow } from '../utils/add-service/flows/nextjs-flow';
import { nestjsFlow } from '../utils/add-service/flows/nestjs-flow';
import { createMockFrameworkConfig } from '../test-fixtures/framework-config';

const mockConfig = createMockFrameworkConfig({
  services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
});

describe('addService', () => {
  beforeEach(() => {
    rs.clearAllMocks();

    // Default setup: config and port
    rs.mocked(loadFrameworkConfig).mockReturnValue(mockConfig);
    rs.mocked(getNextPort).mockReturnValue(3001);

    // Default flow mocks resolve successfully
    rs.mocked(spaFlow).mockResolvedValue(undefined);
    rs.mocked(nextjsFlow).mockResolvedValue(undefined);
    rs.mocked(nestjsFlow).mockResolvedValue(undefined);
  });

  describe('Config and port initialization', () => {
    it('should load config and get next port', async () => {
      rs.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ type: 'spa' })
        .mockResolvedValueOnce({ name: 'my-app' });

      await addService({});

      expect(loadFrameworkConfig).toHaveBeenCalledOnce();
      expect(getNextPort).toHaveBeenCalledWith(mockConfig);
    });
  });

  describe('Service type selection', () => {
    it('should prompt for type when not provided', async () => {
      rs.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ type: 'spa' })
        .mockResolvedValueOnce({ name: 'my-app' });

      await addService({});

      expect(rs.mocked(inquirer.prompt).mock.calls[0]?.[0]).toEqual([
        expect.objectContaining({
          type: 'list',
          name: 'type',
          message: 'Select app type:',
        }),
      ]);
    });

    it('should use provided type and skip type prompt', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValueOnce({ name: 'my-app' });

      await addService({ type: 'spa' });

      // The first prompt call should be for name, not type
      const firstCall = rs.mocked(inquirer.prompt).mock
        .calls[0]?.[0] as unknown as Array<{ name: string }>;
      expect(firstCall[0]?.name).toBe('name');
    });
  });

  describe('Service name selection', () => {
    it('should prompt for name when not provided', async () => {
      rs.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ type: 'spa' })
        .mockResolvedValueOnce({ name: 'my-app' });

      await addService({});

      const namePromptCall = rs.mocked(inquirer.prompt).mock
        .calls[1]?.[0] as unknown as Array<{ name: string; type: string }>;
      expect(namePromptCall[0]?.name).toBe('name');
      expect(namePromptCall[0]?.type).toBe('input');
    });

    it('should use provided name and skip name prompt', async () => {
      await addService({ type: 'spa', name: 'my-app' });

      // No prompts should be called at all
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });
  });

  describe('Flow routing', () => {
    it('should route to spaFlow for type spa', async () => {
      await addService({ type: 'spa', name: 'my-app' });

      expect(spaFlow).toHaveBeenCalledOnce();
      expect(nextjsFlow).not.toHaveBeenCalled();
      expect(nestjsFlow).not.toHaveBeenCalled();
    });

    it('should route to nextjsFlow for type nextjs', async () => {
      await addService({ type: 'nextjs', name: 'my-app' });

      expect(nextjsFlow).toHaveBeenCalledOnce();
      expect(spaFlow).not.toHaveBeenCalled();
      expect(nestjsFlow).not.toHaveBeenCalled();
    });

    it('should route to nestjsFlow for type nestjs', async () => {
      await addService({ type: 'nestjs', name: 'my-service' });

      expect(nestjsFlow).toHaveBeenCalledOnce();
      expect(spaFlow).not.toHaveBeenCalled();
      expect(nextjsFlow).not.toHaveBeenCalled();
    });

    it('should pass correct arguments to flow: name, port, config', async () => {
      rs.mocked(getNextPort).mockReturnValue(3005);

      await addService({ type: 'spa', name: 'dashboard' });

      expect(spaFlow).toHaveBeenCalledWith('dashboard', 3005, mockConfig);
    });
  });

  describe('Validation with provided name', () => {
    it('should call validateServiceName for provided name', async () => {
      await addService({ type: 'spa', name: 'my-app' });

      expect(validateServiceName).toHaveBeenCalledWith('my-app');
    });

    it('should call validateServiceNameAvailable for provided name', async () => {
      await addService({ type: 'spa', name: 'my-app' });

      expect(validateServiceNameAvailable).toHaveBeenCalledWith('my-app');
    });

    it('should validate NestJS name ends with -service', async () => {
      await addService({ type: 'nestjs', name: 'order-service' });

      expect(validateServiceName).toHaveBeenCalledWith('order-service');
      expect(validateServiceNameAvailable).toHaveBeenCalledWith(
        'order-service',
      );
      expect(nestjsFlow).toHaveBeenCalledOnce();
    });

    it('should throw when NestJS name does not end with -service', async () => {
      await expect(
        addService({ type: 'nestjs', name: 'order-api' }),
      ).rejects.toThrow('NestJS service names must end with -service');
    });
  });

  describe('Logging', () => {
    it('should log creating message with type and name', async () => {
      await addService({ type: 'spa', name: 'my-dashboard' });

      expect(logger.info).toHaveBeenCalledWith(
        'Creating spa app: my-dashboard',
      );
    });

    it('should log port number', async () => {
      rs.mocked(getNextPort).mockReturnValue(3007);

      await addService({ type: 'nextjs', name: 'frontend' });

      expect(logger.info).toHaveBeenCalledWith('Port: 3007');
    });
  });
});
