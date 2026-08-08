/**
 * Optionally set up the tsdevstack agent skills for the user's AI assistant.
 *
 * Runs after the project is scaffolded: `npx skills` installs into the new
 * project (which must exist first). With an explicit `agent` (from
 * `init --agent <agent>`) the install runs non-interactively — this is the
 * path AI agents and CI use, where there is no TTY. Without one, the user is
 * prompted interactively, and non-interactive runs just print the manual
 * command. This never fails init — agent skills are an optional extra.
 */

import { spawnSync } from 'child_process';
import inquirer from 'inquirer';
import { logger } from '../logger';
import { isCIEnv } from '../ci';

const SKILLS_SOURCE = 'tsdevstack/skills';
const MANUAL_HINT = `Set up agent skills anytime: npx skills add ${SKILLS_SOURCE}`;

export async function installSkills(
  projectDir: string,
  agent?: string,
): Promise<void> {
  const skillsArgs = ['skills', 'add', SKILLS_SOURCE];

  if (agent) {
    // Explicit agent: install without prompting (works with no TTY / in CI).
    skillsArgs.push('-a', agent, '-y');
  } else {
    const interactive =
      !isCIEnv() &&
      Boolean(process.stdin.isTTY) &&
      Boolean(process.stdout.isTTY);

    if (!interactive) {
      logger.info(MANUAL_HINT);
      return;
    }

    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'setup',
        message: 'Set up tsdevstack agent skills for your AI assistant now?',
        default: true,
      },
    ]);

    if (!(answer.setup as boolean)) {
      logger.info(MANUAL_HINT);
      return;
    }
  }

  logger.newline();
  logger.generating('Installing tsdevstack agent skills...');

  const result = spawnSync('npx', skillsArgs, {
    cwd: projectDir,
    stdio: 'inherit',
  });

  if (result.status === 0) {
    logger.success('Agent skills installed');
  } else {
    logger.warn(`Could not install agent skills. ${MANUAL_HINT}`);
  }
}
