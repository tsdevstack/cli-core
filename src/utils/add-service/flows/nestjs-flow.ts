/**
 * NestJS Flow - Scaffold a new NestJS service
 *
 * Clones from template repo, replaces placeholders, optionally removes Prisma.
 * Config registration happens LAST to ensure clean state on failure.
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import { join } from 'path';
import inquirer from 'inquirer';
import type { FrameworkConfig, FrameworkService } from '../../config/types';
import { saveFrameworkConfig } from '../../config';
import { logger } from '../../logger';
import { findProjectRoot } from '../../paths';
import {
  readPackageJsonFrom,
  extractAuthor,
  writePackageJson,
  deleteFolderRecursive,
} from '../../fs';
import {
  replacePlaceholdersInFile,
  cloneTemplateRepo,
  removeTemplateMetadata,
} from '../../template';
import { NESTJS_TEMPLATE_REPO } from '../../../constants';
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
 * Derive globalPrefix from service name
 * order-service → order
 * user-auth-service → user-auth
 */
function deriveGlobalPrefix(serviceName: string): string {
  return serviceName.replace(/-service$/, '');
}

/**
 * Replace placeholders in all relevant files
 */
function replaceAllPlaceholders(
  appPath: string,
  serviceName: string,
  author: string,
): void {
  const replacements: Record<string, string> = {
    '\\{\\{SERVICE_NAME\\}\\}': serviceName,
    '\\{\\{AUTHOR\\}\\}': author,
  };

  // Files that may contain placeholders
  const filesToProcess = [
    'package.json',
    'prisma/schema.prisma',
    'prisma/seed.ts',
    'src/prisma/prisma.service.ts',
  ];

  for (const file of filesToProcess) {
    const filePath = join(appPath, file);
    replacePlaceholdersInFile(filePath, replacements);
  }
}

/**
 * Remove Prisma-related files and update imports
 */
function removePrisma(appPath: string): void {
  // Remove prisma directory
  const prismaDir = join(appPath, 'prisma');
  if (fs.existsSync(prismaDir)) {
    deleteFolderRecursive(prismaDir);
    logger.info('Removed prisma/ directory');
  }

  // Remove src/prisma directory
  const srcPrismaDir = join(appPath, 'src', 'prisma');
  if (fs.existsSync(srcPrismaDir)) {
    deleteFolderRecursive(srcPrismaDir);
    logger.info('Removed src/prisma/ directory');
  }

  // Update app.module.ts to remove PrismaModule import
  const appModulePath = join(appPath, 'src', 'app.module.ts');
  if (fs.existsSync(appModulePath)) {
    let content = fs.readFileSync(appModulePath, 'utf-8');

    // Remove PrismaModule import line
    content = content.replace(
      /import\s*\{[^}]*PrismaModule[^}]*\}\s*from\s*['"][^'"]+['"];\n?/g,
      '',
    );

    // Remove PrismaModule from imports array
    content = content.replace(/,?\s*PrismaModule\s*,?/g, (match) => {
      // Handle comma positioning
      if (match.startsWith(',') && match.endsWith(',')) {
        return ',';
      }
      return '';
    });

    fs.writeFileSync(appModulePath, content, 'utf-8');
    logger.info('Updated app.module.ts to remove PrismaModule');
  }

  // Update package.json to remove Prisma dependencies
  try {
    const packageJson = readPackageJsonFrom(appPath);

    // Remove from dependencies
    if (
      packageJson.dependencies &&
      typeof packageJson.dependencies === 'object'
    ) {
      const deps = packageJson.dependencies as Record<string, string>;
      delete deps['@prisma/client'];
    }

    // Remove from devDependencies
    if (
      packageJson.devDependencies &&
      typeof packageJson.devDependencies === 'object'
    ) {
      const devDeps = packageJson.devDependencies as Record<string, string>;
      delete devDeps['prisma'];
    }

    // Remove prisma-related scripts
    if (packageJson.scripts && typeof packageJson.scripts === 'object') {
      const scripts = packageJson.scripts as Record<string, string>;
      const keysToRemove = Object.keys(scripts).filter((key) => {
        const value = scripts[key] ?? '';
        // Check both key and value for prisma references
        return (
          key.includes('prisma') ||
          key.includes('db:') ||
          value.includes('prisma')
        );
      });
      for (const key of keysToRemove) {
        delete scripts[key];
      }
    }

    writePackageJson(appPath, packageJson);
    logger.info('Updated package.json to remove Prisma dependencies');
  } catch {
    logger.warn('Could not update package.json to remove Prisma dependencies');
  }
}

export async function nestjsFlow(
  serviceName: string,
  port: number,
  config: FrameworkConfig,
): Promise<void> {
  const projectRoot = findProjectRoot();
  const appPath = join(projectRoot, 'apps', serviceName);
  const author = getAuthor();
  const globalPrefix = deriveGlobalPrefix(serviceName);

  // Check if directory already exists
  if (fs.existsSync(appPath)) {
    throw new Error(`Directory already exists: apps/${serviceName}`);
  }

  // Step 1: Ask about database
  const { includeDatabase } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'includeDatabase',
      message: 'Include database (Prisma)?',
      default: true,
    },
  ]);

  logger.newline();
  logger.generating('Cloning NestJS template...');

  // Step 2: Clone template repo and remove .git
  cloneTemplateRepo(NESTJS_TEMPLATE_REPO, appPath);

  // Step 4: Replace placeholders
  logger.generating('Replacing placeholders...');
  replaceAllPlaceholders(appPath, serviceName, author);
  logger.success('Placeholders replaced');

  // Step 4b: Remove template repository metadata
  removeTemplateMetadata(appPath);

  // Step 4c: Resolve dependency versions against user's project
  try {
    const packageJson = readPackageJsonFrom(appPath);
    resolveTemplateVersions(packageJson, projectRoot);
    writePackageJson(appPath, packageJson);
  } catch {
    logger.warn('Could not resolve template dependency versions');
  }

  // Step 5: Remove Prisma if not needed
  if (!includeDatabase) {
    logger.generating('Removing Prisma setup...');
    removePrisma(appPath);
    logger.success('Prisma removed');
  }

  // ============================================================
  // CONFIG REGISTRATION - Only after all file operations succeed
  // If we reach here, all file operations completed successfully
  // ============================================================

  // Step 6: Register in config.json
  const serviceConfig: FrameworkService = {
    name: serviceName,
    type: 'nestjs',
    port,
    globalPrefix,
    hasDatabase: includeDatabase,
    ...(includeDatabase && { databaseType: 'postgresql' }),
  };

  config.services.push(serviceConfig);
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
  logger.complete(`NestJS service "${serviceName}" created successfully!`);
  logger.newline();
  logger.info('Next steps:');
  logger.info(`  1. cd apps/${serviceName}`);
  if (includeDatabase) {
    logger.info('  2. Update prisma/schema.prisma with your models');
    logger.info('  3. Run: npx prisma migrate dev --name init');
    logger.info('  4. npm run start:dev');
  } else {
    logger.info('  2. npm run start:dev');
  }
  logger.newline();
}
