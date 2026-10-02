import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { mockResolveCliAssetDir } = rs.hoisted(() => ({
  mockResolveCliAssetDir: rs.fn(),
}));

rs.mock('../paths/resolve-cli-asset-dir', () => ({
  resolveCliAssetDir: mockResolveCliAssetDir,
}));

import { stageKongPlugins } from './stage-kong-plugins';
import { CliError } from '../errors';

function writePlugin(dir: string, name: string, marker: string): void {
  fs.mkdirSync(path.join(dir, name), { recursive: true });
  fs.writeFileSync(path.join(dir, name, 'handler.lua'), `-- ${marker}`);
  fs.writeFileSync(path.join(dir, name, 'schema.lua'), `-- ${marker}`);
}

describe('stageKongPlugins', () => {
  let tempDir: string;
  let frameworkDir: string;
  let projectRoot: string;
  let contextDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-kong-plugins-'));
    frameworkDir = path.join(tempDir, 'cli-templates', 'kong-plugins');
    projectRoot = path.join(tempDir, 'project');
    contextDir = path.join(tempDir, 'context');
    fs.mkdirSync(frameworkDir, { recursive: true });
    fs.mkdirSync(contextDir, { recursive: true });
    fs.mkdirSync(projectRoot, { recursive: true });
    mockResolveCliAssetDir.mockReset();
    mockResolveCliAssetDir.mockReturnValue(frameworkDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Standard use cases', () => {
    it('should resolve the framework plugins from the CLI templates', () => {
      stageKongPlugins({ projectRoot, contextDir });
      expect(mockResolveCliAssetDir).toHaveBeenCalledWith('kong-plugins');
    });

    it('should copy framework and project plugins into <context>/kong-plugins', () => {
      writePlugin(frameworkDir, 'tsdevstack-fw', 'framework');
      writePlugin(path.join(projectRoot, 'kong-plugins'), 'my-plugin', 'user');

      stageKongPlugins({ projectRoot, contextDir });

      const staged = path.join(contextDir, 'kong-plugins');
      expect(fs.readdirSync(staged).sort()).toEqual([
        'my-plugin',
        'tsdevstack-fw',
      ]);
      expect(
        fs.readFileSync(
          path.join(staged, 'tsdevstack-fw', 'handler.lua'),
          'utf-8',
        ),
      ).toBe('-- framework');
      expect(
        fs.readFileSync(path.join(staged, 'my-plugin', 'schema.lua'), 'utf-8'),
      ).toBe('-- user');
    });

    it('should copy nested plugin files', () => {
      const userDir = path.join(projectRoot, 'kong-plugins');
      writePlugin(userDir, 'my-plugin', 'user');
      fs.mkdirSync(path.join(userDir, 'my-plugin', 'lib'));
      fs.writeFileSync(path.join(userDir, 'my-plugin', 'lib', 'util.lua'), 'x');

      stageKongPlugins({ projectRoot, contextDir });

      expect(
        fs.existsSync(
          path.join(contextDir, 'kong-plugins', 'my-plugin', 'lib', 'util.lua'),
        ),
      ).toBe(true);
    });

    it('should return KONG_PLUGINS: bundled, oidc, framework, then project plugins', () => {
      writePlugin(frameworkDir, 'tsdevstack-fw', 'framework');
      writePlugin(path.join(projectRoot, 'kong-plugins'), 'b-plugin', 'user');
      writePlugin(path.join(projectRoot, 'kong-plugins'), 'a-plugin', 'user');

      expect(stageKongPlugins({ projectRoot, contextDir })).toEqual([
        'bundled',
        'oidc',
        'tsdevstack-fw',
        'a-plugin',
        'b-plugin',
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should create an empty kong-plugins folder when there are no plugins', () => {
      expect(stageKongPlugins({ projectRoot, contextDir })).toEqual([
        'bundled',
        'oidc',
      ]);
      expect(fs.readdirSync(path.join(contextDir, 'kong-plugins'))).toEqual([]);
    });

    it('should remove plugins staged by a previous run', () => {
      writePlugin(
        path.join(contextDir, 'kong-plugins'),
        'removed-plugin',
        'old',
      );

      stageKongPlugins({ projectRoot, contextDir });

      expect(fs.readdirSync(path.join(contextDir, 'kong-plugins'))).toEqual([]);
    });

    it('should ignore files next to the plugin folders', () => {
      fs.writeFileSync(path.join(frameworkDir, '.gitkeep'), '');
      fs.mkdirSync(path.join(projectRoot, 'kong-plugins'));
      fs.writeFileSync(path.join(projectRoot, 'kong-plugins', 'README.md'), '');

      expect(stageKongPlugins({ projectRoot, contextDir })).toEqual([
        'bundled',
        'oidc',
      ]);
      expect(fs.readdirSync(path.join(contextDir, 'kong-plugins'))).toEqual([]);
    });

    it('should fail on a name collision before touching the staged folder', () => {
      writePlugin(path.join(contextDir, 'kong-plugins'), 'previous', 'old');
      writePlugin(path.join(projectRoot, 'kong-plugins'), 'key-auth', 'user');

      expect(() => stageKongPlugins({ projectRoot, contextDir })).toThrow(
        CliError,
      );
      expect(fs.readdirSync(path.join(contextDir, 'kong-plugins'))).toEqual([
        'previous',
      ]);
    });

    it('should fail on an invalid plugin folder before touching the staged folder', () => {
      writePlugin(path.join(contextDir, 'kong-plugins'), 'previous', 'old');
      fs.mkdirSync(path.join(projectRoot, 'kong-plugins', 'no-schema'), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(projectRoot, 'kong-plugins', 'no-schema', 'handler.lua'),
        '',
      );

      expect(() => stageKongPlugins({ projectRoot, contextDir })).toThrow(
        /missing schema\.lua/,
      );
      expect(fs.readdirSync(path.join(contextDir, 'kong-plugins'))).toEqual([
        'previous',
      ]);
    });

    it('should validate framework plugins too', () => {
      fs.mkdirSync(path.join(frameworkDir, 'Bad_Name'));

      expect(() => stageKongPlugins({ projectRoot, contextDir })).toThrow(
        /invalid plugin name "Bad_Name"/,
      );
    });

    it('should copy a symlinked plugin folder as real files', () => {
      const target = path.join(tempDir, 'elsewhere', 'linked-plugin');
      writePlugin(path.join(tempDir, 'elsewhere'), 'linked-plugin', 'linked');
      fs.mkdirSync(path.join(projectRoot, 'kong-plugins'), { recursive: true });
      fs.symlinkSync(
        target,
        path.join(projectRoot, 'kong-plugins', 'linked-plugin'),
        'dir',
      );

      expect(stageKongPlugins({ projectRoot, contextDir })).toContain(
        'linked-plugin',
      );
      const staged = path.join(contextDir, 'kong-plugins', 'linked-plugin');
      expect(fs.lstatSync(staged).isSymbolicLink()).toBe(false);
      expect(fs.readFileSync(path.join(staged, 'handler.lua'), 'utf-8')).toBe(
        '-- linked',
      );
    });

    it('should fail when a project plugin shadows a framework plugin', () => {
      writePlugin(frameworkDir, 'tsdevstack-fw', 'framework');
      writePlugin(
        path.join(projectRoot, 'kong-plugins'),
        'tsdevstack-fw',
        'user',
      );

      expect(() => stageKongPlugins({ projectRoot, contextDir })).toThrow(
        /tsdevstack-fw/,
      );
    });
  });
});
