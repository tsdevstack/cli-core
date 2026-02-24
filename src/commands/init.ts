/**
 * Init Command
 *
 * Scaffolds a complete tsdevstack monorepo project, ready for add-service and sync.
 *
 * Usage:
 *   npx tsdevstack init
 *   npx tsdevstack init --name my-app --template auth --cloud gcp
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import { join, resolve } from 'path';
import { logger } from '../utils/logger';
import { CliError } from '../utils/errors';
import { writeJsonFile } from '../utils/fs';
import { cloneTemplateRepo, removeTemplateMetadata } from '../utils/template';
import { MONOREPO_TEMPLATE_REPO } from '../constants';
import {
  promptInitOptions,
  checkPrerequisites,
  getCliVersion,
  buildConfig,
  replaceMonorepoPlaceholders,
  scaffoldAuthService,
  scaffoldAuthServiceClient,
  scaffoldFrontend,
  printNextSteps,
} from '../utils/init';
import type { InitCliArgs } from '../utils/init';

export type { InitCliArgs };

export async function init(args: InitCliArgs): Promise<void> {
  logger.newline();
  logger.info('Create a new tsdevstack project');
  logger.newline();

  // Step 1: Gather options via prompts or CLI args
  const options = await promptInitOptions(args);

  // Step 2: Check directory doesn't exist
  const projectDir = resolve(options.projectName);
  if (fs.existsSync(projectDir)) {
    throw new CliError(
      `Directory "${options.projectName}" already exists`,
      'Init',
      'Choose a different project name or remove the existing directory.',
    );
  }

  // Step 3: Check prerequisites
  const { errors, warnings } = checkPrerequisites();

  for (const warning of warnings) {
    logger.warn(warning);
  }

  if (errors.length > 0) {
    throw new CliError(
      errors.join('\n'),
      'Prerequisites',
      'Install the required tools and try again.',
    );
  }

  // Step 4: Get CLI version for placeholder
  const cliVersion = getCliVersion();

  // Step 5: Clone monorepo template
  logger.newline();
  logger.generating('Scaffolding project...');
  cloneTemplateRepo(MONOREPO_TEMPLATE_REPO, projectDir);

  // Step 6: Replace placeholders in template files
  replaceMonorepoPlaceholders(projectDir, options.projectName, cliVersion);
  logger.success('Project scaffolded');

  // Step 7: Remove template metadata from monorepo package.json
  removeTemplateMetadata(projectDir);

  // Step 8: Build config
  const config = buildConfig(options);

  // Step 9: Scaffold template-specific services
  if (options.template === 'auth' || options.template === 'fullstack-auth') {
    scaffoldAuthService(projectDir, config);
  }

  if (options.template === 'fullstack-auth' && options.frontendName) {
    scaffoldAuthServiceClient(projectDir);
    scaffoldFrontend(projectDir, options.frontendName, config);
  }

  // Step 10: Write final config.json with services array
  const configPath = join(projectDir, '.tsdevstack', 'config.json');
  writeJsonFile(configPath, config);
  logger.success('Configuration written');

  // Step 11: npm install
  logger.newline();
  logger.generating('Installing dependencies...');

  const installResult = spawnSync('npm', ['install'], {
    cwd: projectDir,
    stdio: 'inherit',
  });

  if (installResult.status !== 0) {
    logger.warn(
      'npm install had issues. You may need to run "npm install" manually from the project root.',
    );
  } else {
    logger.success('Dependencies installed');
  }

  // Step 12: Build libs and generate OpenAPI docs (needed for Kong config)
  const nestServices = config.services.filter(
    (s: { type: string }) => s.type === 'nestjs',
  );

  if (nestServices.length > 0) {
    logger.newline();
    logger.generating('Building shared packages...');
    const buildLibsResult = spawnSync('npm', ['run', 'build:libs'], {
      cwd: projectDir,
      stdio: 'inherit',
    });

    if (buildLibsResult.status === 0) {
      logger.success('Shared packages built');
    } else {
      logger.warn(
        'Could not build shared packages. Run "npm run build:libs" manually.',
      );
    }

    for (const service of nestServices) {
      logger.generating(`Building ${service.name}...`);
      const buildResult = spawnSync(
        'npm',
        ['run', 'build', '-w', service.name],
        { cwd: projectDir, stdio: 'inherit' },
      );
      if (buildResult.status === 0) {
        logger.success(`${service.name} built`);
      } else {
        logger.warn(`Could not build ${service.name}.`);
      }
    }

    logger.generating('Generating OpenAPI docs...');
    const docsGenerated: string[] = [];
    for (const service of nestServices) {
      const docsResult = spawnSync(
        'npm',
        ['run', 'docs:generate', '-w', service.name],
        { cwd: projectDir, stdio: 'inherit' },
      );
      if (docsResult.status === 0) {
        logger.success(`${service.name} OpenAPI docs generated`);
        docsGenerated.push(service.name);
      } else {
        logger.warn(
          `Could not generate OpenAPI docs for ${service.name}. Run "npm run docs:generate -w ${service.name}" manually.`,
        );
      }
    }

    // Step 12b: Generate HTTP clients from OpenAPI specs
    for (const serviceName of docsGenerated) {
      logger.generating(`Generating HTTP client for ${serviceName}...`);
      const clientResult = spawnSync(
        'npx',
        ['tsdevstack', 'generate-client', serviceName],
        { cwd: projectDir, stdio: 'inherit' },
      );
      if (clientResult.status === 0) {
        logger.success(`${serviceName} HTTP client generated`);
      } else {
        logger.warn(
          `Could not generate HTTP client for ${serviceName}. Run "npx tsdevstack generate-client ${serviceName}" manually.`,
        );
      }
    }
  }

  // Step 13: Run sync (only if services exist and Docker is running)
  if (config.services.length > 0) {
    const dockerCheck = spawnSync('docker', ['info'], { stdio: 'pipe' });

    if (dockerCheck.status !== 0) {
      logger.newline();
      logger.warn(
        'Docker is not running — skipping sync. Start Docker and run "npx tsdevstack sync" from the project root.',
      );
    } else {
      logger.newline();
      logger.generating('Running sync to generate infrastructure files...');

      const syncResult = spawnSync('npx', ['tsdevstack', 'sync'], {
        cwd: projectDir,
        stdio: 'inherit',
      });

      if (syncResult.status !== 0) {
        logger.warn(
          'Sync had issues. You may need to run "npx tsdevstack sync" manually from the project root.',
        );
      } else {
        logger.success('Sync completed');
      }
    }
  }

  // Step 14: Print next steps
  printNextSteps(options);
}
