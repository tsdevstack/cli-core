/**
 * Check whether a tag exists in a remote git repository
 *
 * Uses `git ls-remote --exit-code --tags <url> refs/tags/<tag>`, which exits
 * with 0 when the ref exists and 2 when no ref matches. Any other exit status
 * (unreachable remote, missing repository, git not installed) is an error:
 * we cannot tell whether the tag exists, so we do not silently fall back.
 *
 * The full ref name is used because a short pattern matches any ref ending
 * in the tag name (e.g. "v1.0.0" also matches "refs/tags/foo/v1.0.0").
 *
 * @param repoUrl - Git URL of the repository
 * @param tag - Tag name without the refs/tags/ prefix (e.g. "v0.7.0")
 * @returns true when the tag exists, false when it does not
 * @throws {CliError} When the remote cannot be queried
 */

import { spawnSync } from 'child_process';
import { CliError } from '../errors';

const LS_REMOTE_NO_MATCH_STATUS = 2;

export function remoteTagExists(repoUrl: string, tag: string): boolean {
  const result = spawnSync(
    'git',
    ['ls-remote', '--exit-code', '--tags', repoUrl, `refs/tags/${tag}`],
    { stdio: 'pipe' },
  );

  if (result.status === 0) {
    return true;
  }

  if (result.status === LS_REMOTE_NO_MATCH_STATUS) {
    return false;
  }

  const errorOutput =
    result.stderr?.toString() || result.error?.message || 'Unknown error';
  throw new CliError(
    `Failed to query template repository ${repoUrl}.\n${errorOutput}`,
    'Template clone failed',
    'Make sure git is installed and you have internet access.',
  );
}
