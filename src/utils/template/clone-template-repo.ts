/**
 * Clone a template repository and clean up git metadata
 *
 * Performs a shallow clone (--depth 1) of the template repo into the target
 * directory, then removes the .git directory so the cloned files become
 * part of the user's project.
 *
 * @param repoUrl - Git URL of the template repository
 * @param targetPath - Absolute path to clone into
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import { join } from 'path';
import { CliError } from '../errors';
import { deleteFolderRecursive } from '../fs';
import { logger } from '../logger';

export function cloneTemplateRepo(repoUrl: string, targetPath: string): void {
  const cloneResult = spawnSync(
    'git',
    ['clone', '--depth', '1', repoUrl, targetPath],
    { stdio: 'pipe' },
  );

  if (cloneResult.status !== 0) {
    const errorOutput = cloneResult.stderr?.toString() || 'Unknown error';
    throw new CliError(
      `Failed to clone template repository.\n${errorOutput}`,
      'Template clone failed',
      'Make sure git is installed and you have internet access.',
    );
  }

  logger.success('Template cloned');

  // Remove .git directory so files become part of user's project
  const gitDir = join(targetPath, '.git');
  if (fs.existsSync(gitDir)) {
    deleteFolderRecursive(gitDir);
  }
}
