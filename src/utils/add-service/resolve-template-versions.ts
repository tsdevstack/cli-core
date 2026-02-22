/**
 * Resolve template dependency versions against the user's existing project
 *
 * After cloning a template, dependency versions may conflict with what the
 * user already has. This function aligns the template's versions with the project.
 */

import * as fs from 'fs';
import { join } from 'path';
import type { PackageJson } from '../fs/package-json-types';
import { readPackageJsonFrom } from '../fs';
import { logger } from '../logger';

/**
 * Collect all dependency versions from existing project packages
 */
function collectProjectVersions(projectRoot: string): Map<string, string> {
  const versions = new Map<string, string>();

  // Read root package.json devDependencies (shared tools like typescript, eslint)
  try {
    const rootPkg = readPackageJsonFrom(projectRoot);
    const rootDevDeps = rootPkg.devDependencies as
      | Record<string, string>
      | undefined;
    if (rootDevDeps) {
      for (const [name, version] of Object.entries(rootDevDeps)) {
        versions.set(name, version);
      }
    }
    const rootDeps = rootPkg.dependencies as Record<string, string> | undefined;
    if (rootDeps) {
      for (const [name, version] of Object.entries(rootDeps)) {
        versions.set(name, version);
      }
    }
  } catch {
    // Root package.json might not have dependencies — that's fine
  }

  // Read all existing apps/*/package.json
  const appsDir = join(projectRoot, 'apps');
  if (fs.existsSync(appsDir)) {
    const entries = fs.readdirSync(appsDir);
    for (const entry of entries) {
      const appPath = join(appsDir, entry);
      if (!fs.statSync(appPath).isDirectory()) continue;

      try {
        const pkg = readPackageJsonFrom(appPath);

        const deps = pkg.dependencies as Record<string, string> | undefined;
        if (deps) {
          for (const [name, version] of Object.entries(deps)) {
            versions.set(name, version);
          }
        }

        const devDeps = pkg.devDependencies as
          | Record<string, string>
          | undefined;
        if (devDeps) {
          for (const [name, version] of Object.entries(devDeps)) {
            versions.set(name, version);
          }
        }
      } catch {
        // Skip apps with invalid/missing package.json
      }
    }
  }

  return versions;
}

/**
 * Resolve a template's dependency versions against the user's existing project.
 *
 * For each dependency in the template:
 * - If the package exists in the user's project, use the user's version
 * - If the package is new (not in the project), keep the template default
 * - Workspace packages (version "*") are always skipped
 *
 * Mutates the provided packageJson object in place.
 */
export function resolveTemplateVersions(
  packageJson: PackageJson,
  projectRoot: string,
): void {
  const projectVersions = collectProjectVersions(projectRoot);

  let resolvedCount = 0;

  const depSections = ['dependencies', 'devDependencies'] as const;

  for (const section of depSections) {
    const deps = packageJson[section] as Record<string, string> | undefined;
    if (!deps) continue;

    for (const [name, version] of Object.entries(deps)) {
      // Skip workspace packages (wildcard version)
      if (version === '*') continue;

      const projectVersion = projectVersions.get(name);
      if (
        projectVersion &&
        projectVersion !== '*' &&
        projectVersion !== version
      ) {
        deps[name] = projectVersion;
        resolvedCount++;
      }
    }
  }

  if (resolvedCount > 0) {
    logger.info(
      `Resolved ${resolvedCount} dependency version(s) to match your project`,
    );
  }
}
