import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { listKongPluginDirs } from './list-kong-plugin-dirs';

describe('listKongPluginDirs', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'list-kong-plugins-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Standard use cases', () => {
    it('should return folder names sorted', () => {
      fs.mkdirSync(path.join(tempDir, 'zeta'));
      fs.mkdirSync(path.join(tempDir, 'alpha'));
      expect(listKongPluginDirs(tempDir)).toEqual(['alpha', 'zeta']);
    });
  });

  describe('Edge cases', () => {
    it('should return an empty list when the directory does not exist', () => {
      expect(listKongPluginDirs(path.join(tempDir, 'missing'))).toEqual([]);
    });

    it('should include symlinked plugin folders', () => {
      const target = fs.mkdtempSync(
        path.join(os.tmpdir(), 'kong-plugin-target-'),
      );
      try {
        fs.symlinkSync(target, path.join(tempDir, 'linked-plugin'), 'dir');
        fs.writeFileSync(path.join(tempDir, 'real-file'), '');
        fs.symlinkSync(
          path.join(tempDir, 'real-file'),
          path.join(tempDir, 'linked-file'),
        );
        expect(listKongPluginDirs(tempDir)).toEqual(['linked-plugin']);
      } finally {
        fs.rmSync(target, { recursive: true, force: true });
      }
    });

    it('should skip broken symlinks', () => {
      fs.symlinkSync(
        path.join(tempDir, 'missing-target'),
        path.join(tempDir, 'broken'),
      );
      fs.mkdirSync(path.join(tempDir, 'ok-plugin'));
      expect(listKongPluginDirs(tempDir)).toEqual(['ok-plugin']);
    });

    it('should ignore files and hidden entries', () => {
      fs.writeFileSync(path.join(tempDir, '.gitkeep'), '');
      fs.writeFileSync(path.join(tempDir, 'README.md'), '');
      fs.mkdirSync(path.join(tempDir, '.hidden'));
      fs.mkdirSync(path.join(tempDir, 'my-plugin'));
      expect(listKongPluginDirs(tempDir)).toEqual(['my-plugin']);
    });
  });
});
