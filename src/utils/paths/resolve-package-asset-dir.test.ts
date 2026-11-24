import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolvePackageAssetDir } from './resolve-package-asset-dir';
import { CliError } from '../errors';

describe('resolvePackageAssetDir', () => {
  let tempDir: string;
  let cliPackageJson: string;

  beforeEach(() => {
    // Real path: Node's resolver returns one (macOS's temp folder is a symlink)
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-package-asset-')),
    );
    const cliRoot = path.join(tempDir, 'packages', 'cli-core');
    fs.mkdirSync(cliRoot, { recursive: true });
    cliPackageJson = path.join(cliRoot, 'package.json');
    fs.writeFileSync(
      cliPackageJson,
      JSON.stringify({ name: '@tsdevstack/cli' }),
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Standard use cases', () => {
    it('should find the package in node_modules above the CLI and return its folder', () => {
      const pkg = path.join(tempDir, 'node_modules', '@scope', 'assets');
      fs.mkdirSync(pkg, { recursive: true });
      fs.writeFileSync(
        path.join(pkg, 'package.json'),
        JSON.stringify({ name: '@scope/assets' }),
      );

      expect(
        resolvePackageAssetDir(cliPackageJson, {
          packageName: '@scope/assets',
          dir: 'kong/plugins',
        }),
      ).toBe(path.join(pkg, 'kong', 'plugins'));
    });
  });

  describe('Edge cases', () => {
    it('should throw a CliError when the package is not installed', () => {
      expect(() =>
        resolvePackageAssetDir(cliPackageJson, {
          packageName: '@scope/missing',
          dir: 'kong/plugins',
        }),
      ).toThrow(CliError);
    });
  });
});
