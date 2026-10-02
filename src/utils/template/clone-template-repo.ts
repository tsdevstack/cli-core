/**
 * Clone a template repository and clean up git metadata
 *
 * Performs a shallow clone (--depth 1) of the template repo into the target
 * directory, then removes the .git directory so the cloned files become
 * part of the user's project.
 *
 * Version pinning: the sync workflow tags every template repo with
 * `v{cliVersion}`. The CLI clones the tag matching its own version, so a CLI
 * always gets the templates it was released with. When that tag does not
 * exist in the remote (unreleased or local dev builds, or a version released
 * before tagging), the repository's default branch (main) is cloned instead,
 * with a warning.
 *
 * @param repoUrl - Git URL of the template repository
 * @param targetPath - Absolute path to clone into
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import { join } from 'path';
import { TEMPLATE_VERSION_TAG_PREFIX } from '../../constants';
import { CliError } from '../errors';
import { deleteFolderRecursive } from '../fs';
import { getCliVersion } from '../init/get-cli-version';
import { logger } from '../logger';
import { buildTemplateCloneArgs } from './build-template-clone-args';
import { remoteTagExists } from './remote-tag-exists';
import { removeGitkeepFiles } from './remove-gitkeep-files';

export function cloneTemplateRepo(repoUrl: string, targetPath: string): void {
  const versionTag = `${TEMPLATE_VERSION_TAG_PREFIX}${getCliVersion()}`;

  let ref: string | undefined = versionTag;
  if (!remoteTagExists(repoUrl, versionTag)) {
    logger.warn(
      `Template tag ${versionTag} not found in ${repoUrl}. ` +
        'Using the default branch (main) instead; the template may not match this CLI version.',
    );
    ref = undefined;
  }

  const cloneResult = spawnSync(
    'git',
    buildTemplateCloneArgs(repoUrl, targetPath, ref),
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

  logger.success(ref ? `Template cloned (${ref})` : 'Template cloned');

  // Remove .git directory so files become part of user's project
  const gitDir = join(targetPath, '.git');
  if (fs.existsSync(gitDir)) {
    deleteFolderRecursive(gitDir);
  }

  // Remove .gitkeep files (only needed to preserve empty dirs in git)
  removeGitkeepFiles(targetPath);
}
