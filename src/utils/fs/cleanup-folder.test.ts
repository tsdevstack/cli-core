import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { cleanupFolder } from './cleanup-folder';

describe('cleanupFolder', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cleanup-folder-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should delete all files when no entries to keep', () => {
    fs.writeFileSync(path.join(tempDir, 'a.tf'), 'content');
    fs.writeFileSync(path.join(tempDir, 'b.tf'), 'content');

    cleanupFolder(tempDir, []);

    expect(fs.readdirSync(tempDir)).toEqual([]);
  });

  it('should preserve files in the keep list', () => {
    fs.writeFileSync(path.join(tempDir, 'keep.tf'), 'content');
    fs.writeFileSync(path.join(tempDir, 'delete.tf'), 'content');

    cleanupFolder(tempDir, ['keep.tf']);

    const remaining = fs.readdirSync(tempDir);
    expect(remaining).toEqual(['keep.tf']);
  });

  it('should delete subdirectories', () => {
    fs.mkdirSync(path.join(tempDir, 'lambda'));
    fs.writeFileSync(path.join(tempDir, 'lambda', 'main.tf'), 'content');
    fs.writeFileSync(path.join(tempDir, 'main.tf'), 'content');

    cleanupFolder(tempDir, []);

    expect(fs.readdirSync(tempDir)).toEqual([]);
  });

  it('should preserve subdirectories in the keep list', () => {
    fs.mkdirSync(path.join(tempDir, '.terraform'));
    fs.writeFileSync(path.join(tempDir, '.terraform', 'state.json'), 'content');
    fs.mkdirSync(path.join(tempDir, 'lambda'));
    fs.writeFileSync(path.join(tempDir, 'main.tf'), 'content');

    cleanupFolder(tempDir, ['.terraform']);

    const remaining = fs.readdirSync(tempDir);
    expect(remaining).toEqual(['.terraform']);
    expect(fs.existsSync(path.join(tempDir, '.terraform', 'state.json'))).toBe(
      true,
    );
  });

  it('should handle mixed files and directories with preserve list', () => {
    fs.writeFileSync(path.join(tempDir, 'main.tf'), 'content');
    fs.writeFileSync(path.join(tempDir, '.terraform.lock.hcl'), 'content');
    fs.mkdirSync(path.join(tempDir, '.terraform'));
    fs.mkdirSync(path.join(tempDir, 'lambda'));
    fs.mkdirSync(path.join(tempDir, 'db-init'));

    cleanupFolder(tempDir, ['.terraform', '.terraform.lock.hcl']);

    const remaining = fs.readdirSync(tempDir).sort();
    expect(remaining).toEqual(['.terraform', '.terraform.lock.hcl']);
  });

  it('should handle empty directory', () => {
    cleanupFolder(tempDir, []);

    expect(fs.readdirSync(tempDir)).toEqual([]);
  });

  it('should throw CliError for non-directory path', () => {
    const filePath = path.join(tempDir, 'file.txt');
    fs.writeFileSync(filePath, 'content');

    expect(() => cleanupFolder(filePath, [])).toThrow(
      'Path is not a directory',
    );
  });
});
