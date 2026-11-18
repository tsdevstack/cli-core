/**
 * Run `npx skills add <args>` in the project, with the terminal attached so
 * the skills CLI can ask its own questions. True when it exits with 0, which
 * it also does when the user cancels one of its prompts.
 */

import { spawnSync } from 'child_process';

export function runSkillsAdd(projectDir: string, args: string[]): boolean {
  const result = spawnSync('npx', ['skills', 'add', ...args], {
    cwd: projectDir,
    stdio: 'inherit',
  });

  return result.status === 0;
}
