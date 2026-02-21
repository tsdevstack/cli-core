/**
 * SPA Flow - Scaffold a new SPA using rsbuild
 *
 * Runs create-rsbuild and lets it handle all prompts (framework, TypeScript, ESLint, etc.)
 */

import { spawnSync } from 'child_process';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import type { FrameworkConfig } from '../../config/types';
import { saveFrameworkConfig } from '../../config';
import { logger } from '../../logger';
import { findProjectRoot } from '../../paths';
import { readJsonFile, writeJsonFile } from '../../fs';

export async function spaFlow(
  serviceName: string,
  port: number,
  config: FrameworkConfig,
): Promise<void> {
  const projectRoot = findProjectRoot();
  const appPath = join(projectRoot, 'apps', serviceName);

  logger.newline();
  logger.info('Starting rsbuild scaffolder...');
  logger.newline();

  // Run create-rsbuild with just the directory, let it handle all prompts
  const result = spawnSync(
    'npm',
    ['create', 'rsbuild@latest', '--', '--dir', appPath],
    {
      cwd: projectRoot,
      stdio: 'inherit',
    },
  );

  if (result.status !== 0) {
    throw new Error(
      'Failed to create SPA. Make sure npm is available and you have internet access.',
    );
  }

  // Update package.json name to match service name
  const packageJsonPath = join(appPath, 'package.json');
  try {
    const packageJson = readJsonFile<Record<string, unknown>>(packageJsonPath);
    packageJson.name = serviceName;
    writeJsonFile(packageJsonPath, packageJson);
    logger.success(`Updated package.json name to "${serviceName}"`);
  } catch {
    logger.warn(
      'Could not update package.json name. You may need to update it manually.',
    );
  }

  // Set server.port in rsbuild config to match config.json
  const rsbuildConfigTs = join(appPath, 'rsbuild.config.ts');
  const rsbuildConfigJs = join(appPath, 'rsbuild.config.js');
  const rsbuildConfigMjs = join(appPath, 'rsbuild.config.mjs');

  let rsbuildConfigPath: string | null = null;
  if (existsSync(rsbuildConfigTs)) {
    rsbuildConfigPath = rsbuildConfigTs;
  } else if (existsSync(rsbuildConfigJs)) {
    rsbuildConfigPath = rsbuildConfigJs;
  } else if (existsSync(rsbuildConfigMjs)) {
    rsbuildConfigPath = rsbuildConfigMjs;
  }

  if (rsbuildConfigPath) {
    try {
      let configContent = readFileSync(rsbuildConfigPath, 'utf-8');

      if (!configContent.includes('server')) {
        configContent = configContent.replace(
          'defineConfig({',
          `defineConfig({\n  server: {\n    port: ${port},\n  },`,
        );
        writeFileSync(rsbuildConfigPath, configContent);
        logger.success(`Set dev server port to ${port} in rsbuild.config`);
      }
    } catch {
      logger.warn(
        `Could not update rsbuild.config. Set server.port to ${port} manually.`,
      );
    }
  } else {
    logger.warn(
      `Could not find rsbuild.config. Set server.port to ${port} manually.`,
    );
  }

  // Register in config.json
  config.services.push({
    name: serviceName,
    type: 'spa',
    port,
    hasDatabase: false,
  });
  saveFrameworkConfig(config);
  logger.success(`Registered "${serviceName}" in config.json`);

  // Final output
  logger.newline();
  logger.complete(`SPA "${serviceName}" created successfully!`);
  logger.newline();
  logger.info('Next steps:');
  logger.info(`  1. cd apps/${serviceName}`);
  logger.info('  2. npm install');
  logger.info('  3. npm run dev');
  logger.newline();
  logger.info(
    'Run "npx tsdevstack sync" to update docker-compose and Kong configuration.',
  );
}
