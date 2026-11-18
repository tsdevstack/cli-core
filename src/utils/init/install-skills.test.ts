import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';

rs.mock('inquirer', { mock: true });
rs.mock('child_process', { mock: true });
rs.mock('../ci', { mock: true });
rs.mock('../logger', { mock: true });

import { spawnSync } from 'child_process';
import inquirer from 'inquirer';
import { isCIEnv } from '../ci';
import { logger } from '../logger';
import { CURATED_AGENT_SKILLS } from '../../constants';
import { installSkills } from './install-skills';

const origStdin = process.stdin.isTTY;
const origStdout = process.stdout.isTTY;
const NEXT_DEV_LOOP = CURATED_AGENT_SKILLS[0];

function setInteractive(): void {
  process.stdin.isTTY = true;
  process.stdout.isTTY = true;
}

function mockStatus(status: number): void {
  rs.mocked(spawnSync).mockReturnValueOnce({
    status,
  } as unknown as ReturnType<typeof spawnSync>);
}

function loggedInfo(): string {
  return rs
    .mocked(logger.info)
    .mock.calls.map((call) => String(call[0]))
    .join('\n');
}

describe('installSkills', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    rs.mocked(isCIEnv).mockReturnValue(false);
    rs.mocked(spawnSync).mockReturnValue({
      status: 0,
    } as unknown as ReturnType<typeof spawnSync>);
  });

  afterEach(() => {
    process.stdin.isTTY = origStdin;
    process.stdout.isTTY = origStdout;
  });

  describe('Curated skills', () => {
    it('installs next-dev-loop from a fixed Next.js commit', () => {
      expect(NEXT_DEV_LOOP.name).toBe('next-dev-loop');
      expect(NEXT_DEV_LOOP.source).toMatch(
        /^https:\/\/raw\.githubusercontent\.com\/vercel\/next\.js\/[0-9a-f]{40}\/skills\/next-dev-loop\/SKILL\.md$/,
      );
    });
  });

  describe('Non-interactive', () => {
    it('skips the prompt and install in CI (prints the manual commands)', async () => {
      rs.mocked(isCIEnv).mockReturnValue(true);
      setInteractive(); // even with a TTY, CI short-circuits

      await installSkills('/tmp/proj');

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(spawnSync).not.toHaveBeenCalled();
      expect(loggedInfo()).toContain('npx skills add tsdevstack/skills');
      expect(loggedInfo()).toContain(`npx skills add ${NEXT_DEV_LOOP.source}`);
    });

    it('skips when there is no TTY', async () => {
      process.stdin.isTTY = false;
      process.stdout.isTTY = false;

      await installSkills('/tmp/proj');

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(spawnSync).not.toHaveBeenCalled();
    });
  });

  describe('Explicit agent (--agent)', () => {
    it('installs both without prompting when an agent is given, even with no TTY', async () => {
      process.stdin.isTTY = false;
      process.stdout.isTTY = false;

      await installSkills('/tmp/proj', 'claude-code');

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(spawnSync).toHaveBeenNthCalledWith(
        1,
        'npx',
        ['skills', 'add', 'tsdevstack/skills', '-a', 'claude-code', '-y'],
        expect.objectContaining({ cwd: '/tmp/proj' }),
      );
      expect(spawnSync).toHaveBeenNthCalledWith(
        2,
        'npx',
        ['skills', 'add', NEXT_DEV_LOOP.source, '-a', 'claude-code', '-y'],
        expect.objectContaining({ cwd: '/tmp/proj' }),
      );
      expect(logger.success).toHaveBeenCalledTimes(2);
      expect(logger.info).toHaveBeenCalledWith(NEXT_DEV_LOOP.needs);
    });

    it('installs in CI when an agent is given', async () => {
      rs.mocked(isCIEnv).mockReturnValue(true);

      await installSkills('/tmp/proj', 'cursor');

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(spawnSync).toHaveBeenNthCalledWith(
        1,
        'npx',
        ['skills', 'add', 'tsdevstack/skills', '-a', 'cursor', '-y'],
        expect.objectContaining({ cwd: '/tmp/proj' }),
      );
      expect(spawnSync).toHaveBeenCalledTimes(2);
    });

    it('warns and skips next-dev-loop when the tsdevstack install fails', async () => {
      mockStatus(1);

      await installSkills('/tmp/proj', 'claude-code');

      expect(spawnSync).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalled();
      expect(logger.success).not.toHaveBeenCalled();
    });

    it('warns (does not throw) when only next-dev-loop fails', async () => {
      mockStatus(0);
      mockStatus(1);

      await installSkills('/tmp/proj', 'claude-code');

      expect(logger.success).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`npx skills add ${NEXT_DEV_LOOP.source}`),
      );
      expect(logger.info).not.toHaveBeenCalledWith(NEXT_DEV_LOOP.needs);
    });
  });

  describe('Interactive', () => {
    it('installs both into the project dir when confirmed, letting the skills CLI ask', async () => {
      setInteractive();
      rs.mocked(inquirer.prompt).mockResolvedValueOnce({ setup: true });

      await installSkills('/tmp/proj');

      expect(spawnSync).toHaveBeenNthCalledWith(
        1,
        'npx',
        ['skills', 'add', 'tsdevstack/skills'],
        expect.objectContaining({ cwd: '/tmp/proj' }),
      );
      expect(spawnSync).toHaveBeenNthCalledWith(
        2,
        'npx',
        ['skills', 'add', NEXT_DEV_LOOP.source],
        expect.objectContaining({ cwd: '/tmp/proj' }),
      );
      expect(logger.info).toHaveBeenCalledWith(NEXT_DEV_LOOP.needs);
    });

    it('skips the install when declined', async () => {
      setInteractive();
      rs.mocked(inquirer.prompt).mockResolvedValueOnce({ setup: false });

      await installSkills('/tmp/proj');

      expect(spawnSync).not.toHaveBeenCalled();
      expect(loggedInfo()).toContain('npx skills add tsdevstack/skills');
    });

    it('warns (does not throw) when the install fails', async () => {
      setInteractive();
      rs.mocked(inquirer.prompt).mockResolvedValueOnce({ setup: true });
      mockStatus(1);

      await installSkills('/tmp/proj');

      expect(spawnSync).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
