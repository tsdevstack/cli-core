/**
 * Scaffold frontend from template into a new project
 *
 * Clones the Next.js auth frontend template, replaces placeholders, resolves versions,
 * and registers the service in config.
 */

import { join } from 'path';
import type { FrameworkConfig } from '../config/types';
import { logger } from '../logger';
import { readPackageJsonFrom, writePackageJson } from '../fs';
import {
  replacePlaceholdersInFile,
  cloneTemplateRepo,
  removeTemplateMetadata,
} from '../template';
import { NEXTJS_AUTH_TEMPLATE_REPO } from '../../constants';
import { resolveTemplateVersions } from '../add-service/resolve-template-versions';

export function scaffoldFrontend(
  projectDir: string,
  frontendName: string,
  config: FrameworkConfig,
): void {
  const appPath = join(projectDir, 'apps', frontendName);

  logger.generating('Cloning Next.js auth frontend template...');
  cloneTemplateRepo(NEXTJS_AUTH_TEMPLATE_REPO, appPath);

  // Replace placeholders
  const replacements: Record<string, string> = {
    '\\{\\{SERVICE_NAME\\}\\}': frontendName,
    '\\{\\{AUTHOR\\}\\}': config.project.name,
  };
  replacePlaceholdersInFile(join(appPath, 'package.json'), replacements);

  // Remove template metadata
  removeTemplateMetadata(appPath);

  // Resolve dependency versions (can see auth-service deps since it's cloned first)
  try {
    const packageJson = readPackageJsonFrom(appPath);
    resolveTemplateVersions(packageJson, projectDir);
    writePackageJson(appPath, packageJson);
  } catch {
    logger.warn('Could not resolve frontend template dependency versions');
  }

  // Register in config
  config.services.push({
    name: frontendName,
    type: 'nextjs',
    port: 3000,
    hasDatabase: false,
  });

  logger.success(`${frontendName} scaffolded`);
}
