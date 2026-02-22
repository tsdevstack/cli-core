/**
 * Tests for nestjsFlow
 */

import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { nestjsFlow } from './nestjs-flow';

// Mock dependencies
rs.mock('child_process', { mock: true });
rs.mock('fs', { mock: true });
rs.mock('inquirer', { mock: true });
rs.mock('../../config', { mock: true });
rs.mock('../../logger', { mock: true });
rs.mock('../../paths', { mock: true });
rs.mock('../../fs', { mock: true });
rs.mock('../resolve-template-versions', { mock: true });

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import inquirer from 'inquirer';
import { saveFrameworkConfig } from '../../config';
import { logger } from '../../logger';
import { findProjectRoot } from '../../paths';
import {
  readPackageJsonFrom,
  extractAuthor,
  deleteFolderRecursive,
} from '../../fs';
import { NESTJS_TEMPLATE_REPO } from '../../../constants';
import { resolveTemplateVersions } from '../resolve-template-versions';
import { createMockFrameworkConfig } from '../../../test-fixtures/framework-config';

describe('nestjsFlow', () => {
  const PROJECT_ROOT = '/fake/project';
  const SERVICE_NAME = 'order-service';
  const PORT = 3002;

  beforeEach(() => {
    rs.clearAllMocks();

    // Default mocks for a successful flow
    rs.mocked(findProjectRoot).mockReturnValue(PROJECT_ROOT);
    rs.mocked(readPackageJsonFrom).mockReturnValue({
      name: 'test-project',
      version: '1.0.0',
      author: 'Test Author',
    });
    rs.mocked(extractAuthor).mockReturnValue('Test Author');

    // Directory does not exist by default
    rs.mocked(fs.existsSync).mockReturnValue(false);

    // Inquirer returns includeDatabase: true by default
    rs.mocked(inquirer.prompt).mockResolvedValue({ includeDatabase: true });

    // Git clone succeeds
    rs.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: Buffer.from(''),
      stderr: Buffer.from(''),
      pid: 1234,
      output: [],
      signal: null,
    });

    // fs.readFileSync for placeholder replacement
    rs.mocked(fs.readFileSync).mockReturnValue(
      '{{SERVICE_NAME}} by {{AUTHOR}}',
    );
  });

  describe('directory existence check', () => {
    it('should throw when app directory already exists', async () => {
      // First call: appPath exists check → true
      rs.mocked(fs.existsSync).mockReturnValue(true);

      const config = createMockFrameworkConfig();

      await expect(nestjsFlow(SERVICE_NAME, PORT, config)).rejects.toThrow(
        `Directory already exists: apps/${SERVICE_NAME}`,
      );
    });
  });

  describe('database prompt', () => {
    it('should prompt user for database inclusion', async () => {
      const config = createMockFrameworkConfig();

      await nestjsFlow(SERVICE_NAME, PORT, config);

      expect(inquirer.prompt).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'includeDatabase',
          message: 'Include database (Prisma)?',
          default: true,
        },
      ]);
    });
  });

  describe('template cloning', () => {
    it('should clone template with correct git arguments', async () => {
      const config = createMockFrameworkConfig();

      await nestjsFlow(SERVICE_NAME, PORT, config);

      const expectedAppPath = `${PROJECT_ROOT}/apps/${SERVICE_NAME}`;
      expect(spawnSync).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', NESTJS_TEMPLATE_REPO, expectedAppPath],
        {
          cwd: PROJECT_ROOT,
          stdio: 'pipe',
        },
      );
    });

    it('should throw when clone fails', async () => {
      rs.mocked(spawnSync).mockReturnValue({
        status: 1,
        stdout: Buffer.from(''),
        stderr: Buffer.from('fatal: repository not found'),
        pid: 1234,
        output: [],
        signal: null,
      });

      const config = createMockFrameworkConfig();

      await expect(nestjsFlow(SERVICE_NAME, PORT, config)).rejects.toThrow(
        'Failed to clone template repository.',
      );
    });
  });

  describe('.git directory removal', () => {
    it('should remove .git directory after clone', async () => {
      // existsSync: false for appPath check, true for .git dir check
      rs.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
        const p = String(path);
        if (p === `${PROJECT_ROOT}/apps/${SERVICE_NAME}`) return false;
        if (p.endsWith('.git')) return true;
        return false;
      });

      const config = createMockFrameworkConfig();

      await nestjsFlow(SERVICE_NAME, PORT, config);

      expect(deleteFolderRecursive).toHaveBeenCalledWith(
        `${PROJECT_ROOT}/apps/${SERVICE_NAME}/.git`,
      );
    });
  });

  describe('service config registration', () => {
    it('should register service in config with correct shape when includeDatabase is true', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValue({ includeDatabase: true });

      const config = createMockFrameworkConfig();

      await nestjsFlow(SERVICE_NAME, PORT, config);

      expect(config.services).toHaveLength(1);
      expect(config.services[0]).toEqual({
        name: 'order-service',
        type: 'nestjs',
        port: PORT,
        globalPrefix: 'order',
        hasDatabase: true,
        databaseType: 'postgresql',
      });
    });

    it('should set databaseType to postgresql when includeDatabase is true', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValue({ includeDatabase: true });

      const config = createMockFrameworkConfig();

      await nestjsFlow(SERVICE_NAME, PORT, config);

      expect(config.services[0]?.databaseType).toBe('postgresql');
    });

    it('should not set databaseType when includeDatabase is false', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValue({ includeDatabase: false });

      const config = createMockFrameworkConfig();

      await nestjsFlow(SERVICE_NAME, PORT, config);

      expect(config.services[0]?.databaseType).toBeUndefined();
      expect(config.services[0]?.hasDatabase).toBe(false);
    });
  });

  describe('version resolution', () => {
    it('should call resolveTemplateVersions with package.json and project root', async () => {
      const config = createMockFrameworkConfig();

      await nestjsFlow(SERVICE_NAME, PORT, config);

      expect(resolveTemplateVersions).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test-project' }),
        PROJECT_ROOT,
      );
    });
  });

  describe('globalPrefix derivation', () => {
    it('should derive globalPrefix by removing -service suffix', async () => {
      const config = createMockFrameworkConfig();

      await nestjsFlow('order-service', PORT, config);

      expect(config.services[0]?.globalPrefix).toBe('order');
    });

    it('should handle multi-word service names', async () => {
      const config = createMockFrameworkConfig();

      await nestjsFlow('user-auth-service', PORT, config);

      expect(config.services[0]?.globalPrefix).toBe('user-auth');
    });

    it('should keep name as-is if it does not end with -service', async () => {
      const config = createMockFrameworkConfig();

      await nestjsFlow('notifications', PORT, config);

      expect(config.services[0]?.globalPrefix).toBe('notifications');
    });
  });

  describe('config saving', () => {
    it('should save framework config after registering service', async () => {
      const config = createMockFrameworkConfig();

      await nestjsFlow(SERVICE_NAME, PORT, config);

      expect(saveFrameworkConfig).toHaveBeenCalledWith(config);
    });
  });

  describe('sync command', () => {
    it('should run sync command via spawnSync', async () => {
      const config = createMockFrameworkConfig();

      await nestjsFlow(SERVICE_NAME, PORT, config);

      expect(spawnSync).toHaveBeenCalledWith('npx', ['tsdevstack', 'sync'], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
      });
    });

    it('should run npm install before sync', async () => {
      const config = createMockFrameworkConfig();

      await nestjsFlow(SERVICE_NAME, PORT, config);

      expect(spawnSync).toHaveBeenCalledWith('npm', ['install'], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
      });
    });

    it('should handle sync failure gracefully with a warning', async () => {
      // spawnSync calls: git clone (1), npm install (2), sync (3)
      rs.mocked(spawnSync)
        .mockReturnValueOnce({
          status: 0,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 1234,
          output: [],
          signal: null,
        })
        .mockReturnValueOnce({
          status: 0,
          stdout: Buffer.from(''),
          stderr: Buffer.from(''),
          pid: 1235,
          output: [],
          signal: null,
        })
        .mockReturnValueOnce({
          status: 1,
          stdout: Buffer.from(''),
          stderr: Buffer.from('sync error'),
          pid: 1236,
          output: [],
          signal: null,
        });

      const config = createMockFrameworkConfig();

      // Should not throw
      await nestjsFlow(SERVICE_NAME, PORT, config);

      expect(logger.warn).toHaveBeenCalledWith(
        'Sync command had issues. You may need to run "npx tsdevstack sync" manually.',
      );
    });
  });

  describe('author resolution', () => {
    it('should get author from root package.json', async () => {
      rs.mocked(extractAuthor).mockReturnValue('John Doe');

      const config = createMockFrameworkConfig();

      await nestjsFlow(SERVICE_NAME, PORT, config);

      expect(findProjectRoot).toHaveBeenCalled();
      expect(readPackageJsonFrom).toHaveBeenCalledWith(PROJECT_ROOT);
      expect(extractAuthor).toHaveBeenCalled();
    });

    it('should fall back to tsdevstack when author is unknown', async () => {
      rs.mocked(extractAuthor).mockReturnValue('unknown');

      const config = createMockFrameworkConfig();

      // Enable existsSync to track placeholder file checks
      rs.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
        const p = String(path);
        if (p === `${PROJECT_ROOT}/apps/${SERVICE_NAME}`) return false;
        // Return true for placeholder files so we can verify content
        if (p.includes('package.json') && p.includes(SERVICE_NAME)) return true;
        return false;
      });

      await nestjsFlow(SERVICE_NAME, PORT, config);

      // The author should have been resolved to 'tsdevstack'
      // We verify by checking that writeFileSync was called with content containing 'tsdevstack'
      const writeFileCalls = rs.mocked(fs.writeFileSync).mock.calls;
      const placeholderWriteCall = writeFileCalls.find(
        (call) => typeof call[1] === 'string' && call[1].includes('tsdevstack'),
      );
      expect(placeholderWriteCall).toBeDefined();
    });

    it('should fall back to tsdevstack when readPackageJsonFrom throws', async () => {
      rs.mocked(readPackageJsonFrom).mockImplementation(() => {
        throw new Error('package.json not found');
      });

      const config = createMockFrameworkConfig();

      // Should not throw - falls back gracefully
      await nestjsFlow(SERVICE_NAME, PORT, config);

      // Verify the flow completed (config was saved)
      expect(saveFrameworkConfig).toHaveBeenCalledWith(config);
    });
  });
});
