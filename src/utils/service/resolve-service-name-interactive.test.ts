/**
 * Tests for resolveServiceNameInteractive
 */

import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { resolveServiceNameInteractive } from './resolve-service-name-interactive';

// Mock dependencies
rs.mock('inquirer', { mock: true });
rs.mock('../fs/index', { mock: true });
rs.mock('../config', { mock: true });
rs.mock('../logger', { mock: true });

import inquirer from 'inquirer';
import { readPackageJson } from '../fs/index';
import { createMockFrameworkConfig } from '../../test-fixtures/framework-config';
import { loadFrameworkConfig } from '../config';
import { logger } from '../logger';

describe('resolveServiceNameInteractive', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('when serviceName is provided', () => {
    it('should return the provided service name directly', async () => {
      const result = await resolveServiceNameInteractive('auth-service');

      expect(result).toBe('auth-service');
      // Should not call any other functions
      expect(loadFrameworkConfig).not.toHaveBeenCalled();
      expect(readPackageJson).not.toHaveBeenCalled();
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });
  });

  describe('when serviceName is not provided', () => {
    it('should return service name from current directory if it is a registered service', async () => {
      // Mock config with registered services
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [
            { name: 'auth-service', type: 'nestjs', port: 3000 },
            { name: 'user-service', type: 'nestjs', port: 3001 },
          ],
        }),
      );

      // Mock package.json from current directory
      rs.mocked(readPackageJson).mockReturnValue({
        name: 'auth-service',
        version: '1.0.0',
      });

      const result = await resolveServiceNameInteractive();

      expect(result).toBe('auth-service');
      expect(loadFrameworkConfig).toHaveBeenCalledOnce();
      expect(readPackageJson).toHaveBeenCalledOnce();
      expect(inquirer.prompt).not.toHaveBeenCalled();
    });

    it('should show interactive selector if current directory is not a registered service', async () => {
      // Mock config with registered services
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [
            { name: 'auth-service', type: 'nestjs', port: 3000 },
            { name: 'user-service', type: 'nestjs', port: 3001 },
          ],
        }),
      );

      // Mock package.json with a name that's NOT in the services list
      rs.mocked(readPackageJson).mockReturnValue({
        name: 'some-other-package',
        version: '1.0.0',
      });

      // Mock user selection
      rs.mocked(inquirer.prompt).mockResolvedValue({
        serviceName: 'user-service',
      });

      const result = await resolveServiceNameInteractive();

      expect(result).toBe('user-service');
      expect(loadFrameworkConfig).toHaveBeenCalledOnce();
      expect(readPackageJson).toHaveBeenCalledOnce();
      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'list',
          name: 'serviceName',
          message: 'Select service:',
          choices: ['auth-service', 'user-service'],
        },
      ]);
    });

    it('should show interactive selector if not in a directory with package.json', async () => {
      // Mock config with registered services
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [
            { name: 'auth-service', type: 'nestjs', port: 3000 },
            { name: 'user-service', type: 'nestjs', port: 3001 },
          ],
        }),
      );

      // Mock readPackageJson to throw (not in a directory with package.json)
      rs.mocked(readPackageJson).mockImplementation(() => {
        throw new Error('package.json not found');
      });

      // Mock user selection
      rs.mocked(inquirer.prompt).mockResolvedValue({
        serviceName: 'auth-service',
      });

      const result = await resolveServiceNameInteractive();

      expect(result).toBe('auth-service');
      expect(loadFrameworkConfig).toHaveBeenCalledOnce();
      expect(readPackageJson).toHaveBeenCalledOnce();
      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'list',
          name: 'serviceName',
          message: 'Select service:',
          choices: ['auth-service', 'user-service'],
        },
      ]);
    });

    it('should exit with error if no services found in config', async () => {
      // Mock config with no services
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig(),
      );

      // Mock readPackageJson to throw
      rs.mocked(readPackageJson).mockImplementation(() => {
        throw new Error('package.json not found');
      });

      // Mock process.exit
      const exitSpy = rs.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(resolveServiceNameInteractive()).rejects.toThrow(
        'process.exit called',
      );

      expect(logger.error).toHaveBeenCalledWith(
        'No services found in framework config',
      );
      expect(exitSpy).toHaveBeenCalledWith(1);

      exitSpy.mockRestore();
    });
  });
});
