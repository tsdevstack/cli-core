/**
 * Tests for nextjsAuthFlow
 */

import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { nextjsAuthFlow } from './nextjs-auth-flow';

// Mock dependencies
rs.mock('child_process', { mock: true });
rs.mock('fs', { mock: true });
rs.mock('../../config', { mock: true });
rs.mock('../../logger', { mock: true });
rs.mock('../../paths', { mock: true });
rs.mock('../../fs', { mock: true });
rs.mock('../resolve-template-versions', { mock: true });

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import { saveFrameworkConfig } from '../../config';
import { logger } from '../../logger';
import { findProjectRoot } from '../../paths';
import {
  readPackageJsonFrom,
  extractAuthor,
  deleteFolderRecursive,
} from '../../fs';
import { NEXTJS_AUTH_TEMPLATE_REPO } from '../../../constants';
import { resolveTemplateVersions } from '../resolve-template-versions';
import { createMockFrameworkConfig } from '../../../test-fixtures/framework-config';

describe('nextjsAuthFlow', () => {
  const PROJECT_ROOT = '/fake/project';
  const APP_NAME = 'my-frontend';
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
      rs.mocked(fs.existsSync).mockReturnValue(true);

      const config = createMockFrameworkConfig();

      await expect(nextjsAuthFlow(APP_NAME, PORT, config)).rejects.toThrow(
        `Directory already exists: apps/${APP_NAME}`,
      );
    });
  });

  describe('template cloning', () => {
    it('should clone template with correct git arguments', async () => {
      const config = createMockFrameworkConfig();

      await nextjsAuthFlow(APP_NAME, PORT, config);

      const expectedAppPath = `${PROJECT_ROOT}/apps/${APP_NAME}`;
      expect(spawnSync).toHaveBeenCalledWith(
        'git',
        ['clone', '--depth', '1', NEXTJS_AUTH_TEMPLATE_REPO, expectedAppPath],
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

      await expect(nextjsAuthFlow(APP_NAME, PORT, config)).rejects.toThrow(
        'Failed to clone template repository.',
      );
    });
  });

  describe('.git directory removal', () => {
    it('should remove .git directory after clone', async () => {
      rs.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
        const p = String(path);
        if (p === `${PROJECT_ROOT}/apps/${APP_NAME}`) return false;
        if (p.endsWith('.git')) return true;
        return false;
      });

      const config = createMockFrameworkConfig();

      await nextjsAuthFlow(APP_NAME, PORT, config);

      expect(deleteFolderRecursive).toHaveBeenCalledWith(
        `${PROJECT_ROOT}/apps/${APP_NAME}/.git`,
      );
    });
  });

  describe('placeholder replacement', () => {
    it('should replace placeholders in package.json', async () => {
      rs.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
        const p = String(path);
        if (p === `${PROJECT_ROOT}/apps/${APP_NAME}`) return false;
        if (p.includes('package.json') && p.includes(APP_NAME)) return true;
        return false;
      });

      const config = createMockFrameworkConfig();

      await nextjsAuthFlow(APP_NAME, PORT, config);

      // Verify readFileSync was called for package.json
      expect(fs.readFileSync).toHaveBeenCalledWith(
        `${PROJECT_ROOT}/apps/${APP_NAME}/package.json`,
        'utf-8',
      );

      // Verify writeFileSync was called with replaced content
      const writeFileCalls = rs.mocked(fs.writeFileSync).mock.calls;
      const placeholderWriteCall = writeFileCalls.find(
        (call) => typeof call[1] === 'string' && call[1].includes(APP_NAME),
      );
      expect(placeholderWriteCall).toBeDefined();
    });
  });

  describe('version resolution', () => {
    it('should call resolveTemplateVersions with package.json and project root', async () => {
      const config = createMockFrameworkConfig();

      await nextjsAuthFlow(APP_NAME, PORT, config);

      expect(resolveTemplateVersions).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test-project' }),
        PROJECT_ROOT,
      );
    });
  });

  describe('service config registration', () => {
    it('should register service in config with correct shape', async () => {
      const config = createMockFrameworkConfig();

      await nextjsAuthFlow(APP_NAME, PORT, config);

      expect(config.services).toHaveLength(1);
      expect(config.services[0]).toEqual({
        name: 'my-frontend',
        type: 'nextjs',
        port: PORT,
        hasDatabase: false,
      });
    });
  });

  describe('config saving', () => {
    it('should save framework config after registering service', async () => {
      const config = createMockFrameworkConfig();

      await nextjsAuthFlow(APP_NAME, PORT, config);

      expect(saveFrameworkConfig).toHaveBeenCalledWith(config);
    });
  });

  describe('sync command', () => {
    it('should run sync command via spawnSync', async () => {
      const config = createMockFrameworkConfig();

      await nextjsAuthFlow(APP_NAME, PORT, config);

      expect(spawnSync).toHaveBeenCalledWith('npx', ['tsdevstack', 'sync'], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
      });
    });

    it('should handle sync failure gracefully with a warning', async () => {
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
          status: 1,
          stdout: Buffer.from(''),
          stderr: Buffer.from('sync error'),
          pid: 1235,
          output: [],
          signal: null,
        });

      const config = createMockFrameworkConfig();

      await nextjsAuthFlow(APP_NAME, PORT, config);

      expect(logger.warn).toHaveBeenCalledWith(
        'Sync command had issues. You may need to run "npx tsdevstack sync" manually.',
      );
    });
  });

  describe('author resolution', () => {
    it('should get author from root package.json', async () => {
      rs.mocked(extractAuthor).mockReturnValue('John Doe');

      const config = createMockFrameworkConfig();

      await nextjsAuthFlow(APP_NAME, PORT, config);

      expect(findProjectRoot).toHaveBeenCalled();
      expect(readPackageJsonFrom).toHaveBeenCalledWith(PROJECT_ROOT);
      expect(extractAuthor).toHaveBeenCalled();
    });

    it('should fall back to tsdevstack when author is unknown', async () => {
      rs.mocked(extractAuthor).mockReturnValue('unknown');

      const config = createMockFrameworkConfig();

      rs.mocked(fs.existsSync).mockImplementation((path: fs.PathLike) => {
        const p = String(path);
        if (p === `${PROJECT_ROOT}/apps/${APP_NAME}`) return false;
        if (p.includes('package.json') && p.includes(APP_NAME)) return true;
        return false;
      });

      await nextjsAuthFlow(APP_NAME, PORT, config);

      const writeFileCalls = rs.mocked(fs.writeFileSync).mock.calls;
      const placeholderWriteCall = writeFileCalls.find(
        (call) => typeof call[1] === 'string' && call[1].includes('tsdevstack'),
      );
      expect(placeholderWriteCall).toBeDefined();
    });
  });
});
