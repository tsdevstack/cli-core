/**
 * Scaffold auth-service from template into a new project
 *
 * Clones the auth-service template, replaces placeholders, resolves versions,
 * and registers the service in config.
 */

import { join } from 'path';
import type { FrameworkConfig, FrameworkService } from '../config/types';
import { logger } from '../logger';
import { readPackageJsonFrom, writePackageJson } from '../fs';
import {
  replacePlaceholdersInFile,
  cloneTemplateRepo,
  removeTemplateMetadata,
} from '../template';
import { NESTJS_AUTH_TEMPLATE_REPO } from '../../constants';
import { resolveTemplateVersions } from '../add-service/resolve-template-versions';

export function scaffoldAuthService(
  projectDir: string,
  config: FrameworkConfig,
): void {
  const appPath = join(projectDir, 'apps', 'auth-service');

  logger.generating('Cloning auth-service template...');
  cloneTemplateRepo(NESTJS_AUTH_TEMPLATE_REPO, appPath);

  // Replace placeholders
  const replacements: Record<string, string> = {
    '\\{\\{SERVICE_NAME\\}\\}': 'auth-service',
    '\\{\\{AUTHOR\\}\\}': config.project.name,
  };
  const filesToProcess = [
    'package.json',
    'prisma/schema.prisma',
    'prisma/seed.ts',
    'src/prisma/prisma.service.ts',
  ];
  for (const file of filesToProcess) {
    replacePlaceholdersInFile(join(appPath, file), replacements);
  }

  // Remove template metadata
  removeTemplateMetadata(appPath);

  // Resolve dependency versions
  try {
    const packageJson = readPackageJsonFrom(appPath);
    resolveTemplateVersions(packageJson, projectDir);
    writePackageJson(appPath, packageJson);
  } catch {
    logger.warn('Could not resolve auth-service template dependency versions');
  }

  // Register in config
  const serviceConfig: FrameworkService = {
    name: 'auth-service',
    type: 'nestjs',
    port: 3001,
    globalPrefix: 'auth',
    hasDatabase: true,
    databaseType: 'postgresql',
  };
  config.services.push(serviceConfig);

  logger.success('auth-service scaffolded');
}
