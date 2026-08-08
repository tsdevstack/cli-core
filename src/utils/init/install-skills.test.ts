import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';

rs.mock('inquirer', { mock: true });
rs.mock('child_process', { mock: true });
rs.mock('../ci', { mock: true });
rs.mock('../logger', { mock: true });

import { spawnSync } from 'child_process';
import inquirer from 'inquirer';
import { isCIEnv } from '../ci';
import { logger } from '../logger';
import { installSkills } from './install-skills';

const origStdin = process.stdin.isTTY;
const origStdout = process.stdout.isTTY;

function setInteractive(): void {
  process.stdin.isTTY = true;
  process.stdout.isTTY = true;
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

  describe('Non-interactive', () => {
    it('skips the prompt and install in CI (prints the manual hint)', async () => {
      rs.mocked(isCIEnv).mockReturnValue(true);
      setInteractive(); // even with a TTY, CI short-circuits

      await installSkills('/tmp/proj');

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(spawnSync).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
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
    it('installs without prompting when an agent is given, even with no TTY', async () => {
      process.stdin.isTTY = false;
      process.stdout.isTTY = false;

      await installSkills('/tmp/proj', 'claude-code');

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(spawnSync).toHaveBeenCalledWith(
        'npx',
        ['skills', 'add', 'tsdevstack/skills', '-a', 'claude-code', '-y'],
        expect.objectContaining({ cwd: '/tmp/proj' }),
      );
      expect(logger.success).toHaveBeenCalled();
    });

    it('installs in CI when an agent is given', async () => {
      rs.mocked(isCIEnv).mockReturnValue(true);

      await installSkills('/tmp/proj', 'cursor');

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(spawnSync).toHaveBeenCalledWith(
        'npx',
        ['skills', 'add', 'tsdevstack/skills', '-a', 'cursor', '-y'],
        expect.objectContaining({ cwd: '/tmp/proj' }),
      );
    });

    it('warns (does not throw) when the explicit install fails', async () => {
      rs.mocked(spawnSync).mockReturnValue({
        status: 1,
      } as unknown as ReturnType<typeof spawnSync>);

      await installSkills('/tmp/proj', 'claude-code');

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('Interactive', () => {
    it('installs skills into the project dir when confirmed', async () => {
      setInteractive();
      rs.mocked(inquirer.prompt).mockResolvedValueOnce({ setup: true });

      await installSkills('/tmp/proj');

      expect(spawnSync).toHaveBeenCalledWith(
        'npx',
        ['skills', 'add', 'tsdevstack/skills'],
        expect.objectContaining({ cwd: '/tmp/proj' }),
      );
      expect(logger.success).toHaveBeenCalled();
    });

    it('skips the install when declined', async () => {
      setInteractive();
      rs.mocked(inquirer.prompt).mockResolvedValueOnce({ setup: false });

      await installSkills('/tmp/proj');

      expect(spawnSync).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
    });

    it('warns (does not throw) when the install fails', async () => {
      setInteractive();
      rs.mocked(inquirer.prompt).mockResolvedValueOnce({ setup: true });
      rs.mocked(spawnSync).mockReturnValue({
        status: 1,
      } as unknown as ReturnType<typeof spawnSync>);

      await installSkills('/tmp/proj');

      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
