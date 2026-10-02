import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveCliAssetDir } from './resolve-cli-asset-dir';
import { CliError } from '../errors';

describe('resolveCliAssetDir', () => {
  let tempDir: string;
  let packageRoot: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-cli-asset-'));
    packageRoot = path.join(tempDir, 'node_modules', '@tsdevstack', 'cli');
    fs.mkdirSync(path.join(packageRoot, 'dist', 'plugin'), { recursive: true });
    fs.mkdirSync(path.join(packageRoot, 'dist', 'templates', 'kong-plugins'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(packageRoot, 'src', 'utils', 'paths'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(packageRoot, 'src', 'templates', 'kong-plugins'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({ name: '@tsdevstack/cli' }),
    );
    // An unrelated package.json above the CLI package must be skipped
    fs.writeFileSync(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'user-project' }),
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Standard use cases', () => {
    it('should resolve dist/templates from the bundled CLI (dist/cli.js)', () => {
      expect(
        resolveCliAssetDir('kong-plugins', path.join(packageRoot, 'dist')),
      ).toBe(path.join(packageRoot, 'dist', 'templates', 'kong-plugins'));
    });

    it('should resolve dist/templates from the plugin entry (dist/plugin)', () => {
      expect(
        resolveCliAssetDir(
          'kong-plugins',
          path.join(packageRoot, 'dist', 'plugin'),
        ),
      ).toBe(path.join(packageRoot, 'dist', 'templates', 'kong-plugins'));
    });

    it('should resolve src/templates from the sources', () => {
      expect(
        resolveCliAssetDir(
          'kong-plugins',
          path.join(packageRoot, 'src', 'utils', 'paths'),
        ),
      ).toBe(path.join(packageRoot, 'src', 'templates', 'kong-plugins'));
    });

    it("should resolve this repository's framework Kong plugins by default", () => {
      const resolved = resolveCliAssetDir('kong-plugins');
      expect(
        resolved.endsWith(path.join('src', 'templates', 'kong-plugins')),
      ).toBe(true);
      expect(fs.existsSync(resolved)).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should throw a CliError when the asset directory is missing', () => {
      expect(() =>
        resolveCliAssetDir('missing', path.join(packageRoot, 'dist')),
      ).toThrow(CliError);
    });

    it('should throw a CliError outside the CLI package', () => {
      expect(() => resolveCliAssetDir('kong-plugins', tempDir)).toThrow(
        CliError,
      );
    });
  });
});
