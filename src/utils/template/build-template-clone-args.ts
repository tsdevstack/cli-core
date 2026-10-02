/**
 * Build the `git clone` arguments for a template repository
 *
 * Always a shallow clone (--depth 1). When a ref (tag or branch) is given,
 * `--branch <ref>` pins the clone to it; without one, git clones the
 * repository's default branch.
 *
 * @param repoUrl - Git URL of the template repository
 * @param targetPath - Absolute path to clone into
 * @param ref - Optional tag or branch to clone (e.g. "v0.7.0")
 * @returns Arguments for `git`
 */

export function buildTemplateCloneArgs(
  repoUrl: string,
  targetPath: string,
  ref?: string,
): string[] {
  const args = ['clone', '--depth', '1'];

  if (ref) {
    args.push('--branch', ref);
  }

  args.push(repoUrl, targetPath);
  return args;
}
