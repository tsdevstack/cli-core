/**
 * Next.js Auth Flow - Scaffold a new Next.js app with full authentication
 *
 * Clones from template repo, replaces placeholders, resolves dependency versions.
 * Config registration happens LAST to ensure clean state on failure.
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import { join } from 'path';
import type { FrameworkConfig } from '../../config/types';
import { saveFrameworkConfig } from '../../config';
import { logger } from '../../logger';
import { findProjectRoot } from '../../paths';
import {
  readPackageJsonFrom,
  extractAuthor,
  writePackageJson,
  deleteFolderRecursive,
} from '../../fs';
import { NEXTJS_AUTH_TEMPLATE_REPO } from '../../../constants';
import { resolveTemplateVersions } from '../resolve-template-versions';

/**
 * Get author from root package.json
 * Falls back to 'tsdevstack' if not found
 */
function getAuthor(): string {
  try {
    const projectRoot = findProjectRoot();
    const rootPackageJson = readPackageJsonFrom(projectRoot);
    const author = extractAuthor(rootPackageJson);
    return author === 'unknown' ? 'tsdevstack' : author;
  } catch {
    return 'tsdevstack';
  }
}

/**
 * Replace placeholders in a file
 */
function replacePlaceholdersInFile(
  filePath: string,
  replacements: Record<string, string>,
): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.replace(new RegExp(placeholder, 'g'), value);
  }

  fs.writeFileSync(filePath, content, 'utf-8');
}

export async function nextjsAuthFlow(
  serviceName: string,
  port: number,
  config: FrameworkConfig,
): Promise<void> {
  const projectRoot = findProjectRoot();
  const appPath = join(projectRoot, 'apps', serviceName);
  const author = getAuthor();

  // Check if directory already exists
  if (fs.existsSync(appPath)) {
    throw new Error(`Directory already exists: apps/${serviceName}`);
  }

  logger.newline();
  logger.generating('Cloning Next.js auth template...');

  // Step 1: Clone template repo
  const cloneResult = spawnSync(
    'git',
    ['clone', '--depth', '1', NEXTJS_AUTH_TEMPLATE_REPO, appPath],
    {
      cwd: projectRoot,
      stdio: 'pipe',
    },
  );

  if (cloneResult.status !== 0) {
    const errorOutput = cloneResult.stderr?.toString() || 'Unknown error';
    throw new Error(
      `Failed to clone template repository.\n${errorOutput}\nMake sure git is installed and you have internet access.`,
    );
  }

  logger.success('Template cloned');

  // Step 2: Remove .git directory
  const gitDir = join(appPath, '.git');
  if (fs.existsSync(gitDir)) {
    deleteFolderRecursive(gitDir);
    logger.info('Removed .git directory');
  }

  // Step 3: Replace placeholders
  logger.generating('Replacing placeholders...');
  const replacements: Record<string, string> = {
    '\\{\\{SERVICE_NAME\\}\\}': serviceName,
    '\\{\\{AUTHOR\\}\\}': author,
  };
  replacePlaceholdersInFile(join(appPath, 'package.json'), replacements);
  logger.success('Placeholders replaced');

  // Step 4: Remove template repository metadata from package.json
  try {
    const packageJson = readPackageJsonFrom(appPath);
    delete (packageJson as Record<string, unknown>).repository;
    delete (packageJson as Record<string, unknown>).homepage;
    delete (packageJson as Record<string, unknown>).bugs;

    // Step 5: Resolve dependency versions against user's project
    resolveTemplateVersions(packageJson, projectRoot);

    writePackageJson(appPath, packageJson);
    logger.success('Package.json updated');
  } catch {
    logger.warn('Could not update package.json metadata');
  }

  // ============================================================
  // CONFIG REGISTRATION - Only after all file operations succeed
  // ============================================================

  // Step 6: Register in config.json
  config.services.push({
    name: serviceName,
    type: 'nextjs',
    port,
    hasDatabase: false,
  });
  saveFrameworkConfig(config);
  logger.success(`Registered "${serviceName}" in config.json`);

  // Step 7: Install dependencies (monorepo-level npm install picks up new workspace)
  logger.newline();
  logger.generating('Installing dependencies...');

  const installResult = spawnSync('npm', ['install'], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (installResult.status !== 0) {
    logger.warn(
      'npm install had issues. You may need to run "npm install" manually from the project root.',
    );
  } else {
    logger.success('Dependencies installed');
  }

  // Step 8: Run sync to update docker-compose, Kong, secrets
  logger.newline();
  logger.generating('Running sync to update infrastructure files...');

  const syncResult = spawnSync('npx', ['tsdevstack', 'sync'], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (syncResult.status !== 0) {
    logger.warn(
      'Sync command had issues. You may need to run "npx tsdevstack sync" manually.',
    );
  } else {
    logger.success('Sync completed');
  }

  // Final output
  logger.newline();
  logger.complete(`Next.js app "${serviceName}" created successfully!`);
  logger.newline();
  logger.info('Next steps:');
  logger.info(`  1. cd apps/${serviceName}`);
  logger.info('  2. npm run dev');
  logger.newline();
}
