import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import { join } from 'path';
import { removeGitkeepFiles } from './remove-gitkeep-files';

describe('removeGitkeepFiles', () => {
  const tmpDir = join(__dirname, '__test-tmp-gitkeep__');

  beforeEach(() => {
    fs.mkdirSync(join(tmpDir, 'apps'), { recursive: true });
    fs.mkdirSync(join(tmpDir, 'packages', 'nested'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should remove .gitkeep files from all directories', () => {
    fs.writeFileSync(join(tmpDir, 'apps', '.gitkeep'), '');
    fs.writeFileSync(join(tmpDir, 'packages', '.gitkeep'), '');

    removeGitkeepFiles(tmpDir);

    expect(fs.existsSync(join(tmpDir, 'apps', '.gitkeep'))).toBe(false);
    expect(fs.existsSync(join(tmpDir, 'packages', '.gitkeep'))).toBe(false);
  });

  it('should remove nested .gitkeep files', () => {
    fs.writeFileSync(join(tmpDir, 'packages', 'nested', '.gitkeep'), '');

    removeGitkeepFiles(tmpDir);

    expect(fs.existsSync(join(tmpDir, 'packages', 'nested', '.gitkeep'))).toBe(
      false,
    );
  });

  it('should not remove non-.gitkeep files', () => {
    fs.writeFileSync(join(tmpDir, 'apps', 'keep-me.txt'), 'hello');
    fs.writeFileSync(join(tmpDir, 'apps', '.gitkeep'), '');

    removeGitkeepFiles(tmpDir);

    expect(fs.existsSync(join(tmpDir, 'apps', 'keep-me.txt'))).toBe(true);
    expect(fs.existsSync(join(tmpDir, 'apps', '.gitkeep'))).toBe(false);
  });

  it('should handle directories with no .gitkeep files', () => {
    fs.writeFileSync(join(tmpDir, 'apps', 'file.ts'), '');

    expect(() => removeGitkeepFiles(tmpDir)).not.toThrow();
  });
});
