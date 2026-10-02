/**
 * Integration test: cloneTemplateRepo against a real local bare repository.
 *
 * No network. The fixture is a bare repo in a temp dir with two commits on
 * main; the first commit is tagged v1.2.3. Only getCliVersion and the logger
 * are mocked; git, ls-remote and the filesystem are real.
 */

import {
  describe,
  it,
  expect,
  rs,
  beforeAll,
  afterAll,
  beforeEach,
} from '@rstest/core';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';

const { mockGetCliVersion, mockLogger } = rs.hoisted(() => ({
  mockGetCliVersion: rs.fn(),
  mockLogger: {
    success: rs.fn(),
    warn: rs.fn(),
  },
}));

rs.mock('../init/get-cli-version', () => ({
  getCliVersion: mockGetCliVersion,
}));
rs.mock('../logger', () => ({
  logger: mockLogger,
}));

import { cloneTemplateRepo } from './clone-template-repo';
import { CliError } from '../errors';

const GIT_FIXTURE_CONFIG = [
  '-c',
  'user.name=tsdevstack-test',
  '-c',
  'user.email=test@tsdevstack.invalid',
  '-c',
  'commit.gpgsign=false',
  '-c',
  'tag.gpgsign=false',
];

function git(cwd: string, args: string[]): void {
  const result = spawnSync('git', [...GIT_FIXTURE_CONFIG, ...args], {
    cwd,
    stdio: 'pipe',
  });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(' ')} failed: ${result.stderr?.toString() ?? ''}`,
    );
  }
}

describe('cloneTemplateRepo (integration, local bare repo)', () => {
  let tempDir: string;
  let repoUrl: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clone-template-repo-'));
    const barePath = path.join(tempDir, 'template.git');
    const workPath = path.join(tempDir, 'work');

    git(tempDir, ['init', '--bare', '-b', 'main', barePath]);
    git(tempDir, ['init', '-b', 'main', workPath]);

    // Commit 1 (tagged v1.2.3)
    fs.writeFileSync(path.join(workPath, 'tagged.txt'), 'tagged');
    fs.mkdirSync(path.join(workPath, 'empty-dir'));
    fs.writeFileSync(path.join(workPath, 'empty-dir', '.gitkeep'), '');
    git(workPath, ['add', '-A']);
    git(workPath, ['commit', '--no-verify', '-m', 'tagged commit']);
    git(workPath, ['tag', 'v1.2.3']);

    // Commit 2 (main only)
    fs.writeFileSync(path.join(workPath, 'main-only.txt'), 'main');
    git(workPath, ['add', '-A']);
    git(workPath, ['commit', '--no-verify', '-m', 'main commit']);

    git(workPath, ['push', barePath, 'main', '--tags']);

    repoUrl = pathToFileURL(barePath).href;
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should clone the tag matching the CLI version when it exists', () => {
    mockGetCliVersion.mockReturnValue('1.2.3');
    const targetPath = path.join(tempDir, 'clone-tagged');

    cloneTemplateRepo(repoUrl, targetPath);

    expect(fs.existsSync(path.join(targetPath, 'tagged.txt'))).toBe(true);
    expect(fs.existsSync(path.join(targetPath, 'main-only.txt'))).toBe(false);
    expect(fs.existsSync(path.join(targetPath, '.git'))).toBe(false);
    expect(fs.existsSync(path.join(targetPath, 'empty-dir', '.gitkeep'))).toBe(
      false,
    );
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.success).toHaveBeenCalledWith('Template cloned (v1.2.3)');
  });

  it('should fall back to main with a warning when the tag does not exist', () => {
    mockGetCliVersion.mockReturnValue('9.9.9');
    const targetPath = path.join(tempDir, 'clone-fallback');

    cloneTemplateRepo(repoUrl, targetPath);

    expect(fs.existsSync(path.join(targetPath, 'tagged.txt'))).toBe(true);
    expect(fs.existsSync(path.join(targetPath, 'main-only.txt'))).toBe(true);
    expect(fs.existsSync(path.join(targetPath, '.git'))).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Template tag v9.9.9 not found'),
    );
    expect(mockLogger.success).toHaveBeenCalledWith('Template cloned');
  });

  it('should throw CliError and not fall back when the repository does not exist', () => {
    mockGetCliVersion.mockReturnValue('1.2.3');
    const missingUrl = pathToFileURL(path.join(tempDir, 'missing.git')).href;
    const targetPath = path.join(tempDir, 'clone-missing');

    expect(() => cloneTemplateRepo(missingUrl, targetPath)).toThrow(CliError);
    expect(fs.existsSync(targetPath)).toBe(false);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
});
