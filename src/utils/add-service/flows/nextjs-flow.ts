/**
 * Next.js Flow - Scaffold a new Next.js app
 *
 * Runs create-next-app and lets it handle all prompts, then adds standalone output
 */

import { spawnSync } from 'child_process';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import type { FrameworkConfig } from '../../config/types';
import { saveFrameworkConfig } from '../../config';
import { logger } from '../../logger';
import { findProjectRoot } from '../../paths';

export async function nextjsFlow(
  serviceName: string,
  port: number,
  config: FrameworkConfig
): Promise<void> {
  const projectRoot = findProjectRoot();
  const appPath = join(projectRoot, 'apps', serviceName);

  logger.newline();
  logger.info('Starting Next.js scaffolder...');
  logger.newline();

  // Run create-next-app, let it handle all prompts
  const result = spawnSync('npx', ['create-next-app@latest', appPath], {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(
      'Failed to create Next.js app. Make sure npm is available and you have internet access.'
    );
  }

  // Add output: "standalone" to next.config for Docker deployment
  const nextConfigPath = join(appPath, 'next.config.ts');
  const nextConfigJsPath = join(appPath, 'next.config.js');
  const nextConfigMjsPath = join(appPath, 'next.config.mjs');

  let configPath: string | null = null;
  if (existsSync(nextConfigPath)) {
    configPath = nextConfigPath;
  } else if (existsSync(nextConfigMjsPath)) {
    configPath = nextConfigMjsPath;
  } else if (existsSync(nextConfigJsPath)) {
    configPath = nextConfigJsPath;
  }

  if (configPath) {
    try {
      let configContent = readFileSync(configPath, 'utf-8');

      if (!configContent.includes('output')) {
        if (configContent.includes('const nextConfig = {')) {
          configContent = configContent.replace(
            'const nextConfig = {',
            'const nextConfig = {\n  output: "standalone",'
          );
        } else if (configContent.includes('const nextConfig: NextConfig = {')) {
          configContent = configContent.replace(
            'const nextConfig: NextConfig = {',
            'const nextConfig: NextConfig = {\n  output: "standalone",'
          );
        } else if (configContent.includes('export default {')) {
          configContent = configContent.replace(
            'export default {',
            'export default {\n  output: "standalone",'
          );
        }

        writeFileSync(configPath, configContent);
        logger.success('Added output: "standalone" to next.config');
      }
    } catch {
      logger.warn('Could not update next.config. You may need to add output: "standalone" manually.');
    }
  } else {
    logger.warn('Could not find next.config file. You may need to add output: "standalone" manually.');
  }

  // Register in config.json
  config.services.push({
    name: serviceName,
    type: 'nextjs',
    port,
    hasDatabase: false,
  });
  saveFrameworkConfig(config);
  logger.success(`Registered "${serviceName}" in config.json`);

  // Final output
  logger.newline();
  logger.complete(`Next.js app "${serviceName}" created successfully!`);
  logger.newline();
  logger.info('Next steps:');
  logger.info(`  1. cd apps/${serviceName}`);
  logger.info('  2. npm install');
  logger.info('  3. npm run dev');
  logger.newline();
  logger.info('Run "npx tsdevstack sync" to update docker-compose and Kong configuration.');
}
