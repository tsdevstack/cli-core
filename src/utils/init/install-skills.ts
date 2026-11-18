/**
 * Optionally set up agent skills for the user's AI assistant: the tsdevstack
 * skills, then the curated third-party ones (CURATED_AGENT_SKILLS).
 *
 * Runs after the project is scaffolded: `npx skills` installs into the new
 * project (which must exist first). With an explicit `agent` (from
 * `init --agent <agent>`) every install runs non-interactively — this is the
 * path AI agents and CI use, where there is no TTY. Without one, the user is
 * asked once, then the skills CLI asks its own questions for each install
 * (it remembers the agents picked the first time); non-interactive runs just
 * print the manual commands. The curated skills install only after the
 * tsdevstack ones did. This never fails init — agent skills are an optional
 * extra.
 */

import inquirer from 'inquirer';
import { logger } from '../logger';
import { isCIEnv } from '../ci';
import {
  CURATED_AGENT_SKILLS,
  TSDEVSTACK_SKILLS_SOURCE,
} from '../../constants';
import { runSkillsAdd } from './run-skills-add';

export async function installSkills(
  projectDir: string,
  agent?: string,
): Promise<void> {
  // Explicit agent: install without prompting (works with no TTY / in CI).
  const agentArgs = agent ? ['-a', agent, '-y'] : [];
  const manualHints = [
    `Set up agent skills anytime: npx skills add ${TSDEVSTACK_SKILLS_SOURCE}`,
    ...CURATED_AGENT_SKILLS.map(
      (skill) => `Add ${skill.name} anytime: npx skills add ${skill.source}`,
    ),
  ].join('\n');

  if (!agent) {
    const interactive =
      !isCIEnv() &&
      Boolean(process.stdin.isTTY) &&
      Boolean(process.stdout.isTTY);

    if (!interactive) {
      logger.info(manualHints);
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
      logger.info(manualHints);
      return;
    }
  }

  logger.newline();
  logger.generating('Installing tsdevstack agent skills...');

  if (!runSkillsAdd(projectDir, [TSDEVSTACK_SKILLS_SOURCE, ...agentArgs])) {
    logger.warn('Could not install agent skills.');
    logger.info(manualHints);
    return;
  }
  logger.success('Agent skills installed');

  for (const skill of CURATED_AGENT_SKILLS) {
    logger.newline();
    logger.generating(`Installing ${skill.name}...`);

    if (runSkillsAdd(projectDir, [skill.source, ...agentArgs])) {
      logger.success(`${skill.name} installed`);
      logger.info(skill.needs);
    } else {
      logger.warn(
        `Could not install ${skill.name}. Add it anytime: npx skills add ${skill.source}`,
      );
    }
  }
}
