#!/usr/bin/env node

/**
 * tsdevstack CLI entry point
 *
 * Usage:
 *   tsdevstack generate-client --input ./docs/openapi.json
 *   tsdevstack generate-kong
 *   tsdevstack sync
 *   tsdevstack --help
 *   tsdevstack --version
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Bundled plugins (static imports — devDependencies bundled by rslib)
import {
  initContext,
  registerCloudPlugin,
} from '@tsdevstack/cli-cloud-secrets';
import {
  initContext as initInfraContext,
  registerInfraPlugin,
} from '@tsdevstack/cli-infra';
// Core commands
import { generateClient } from './commands/generate-client';
import { generateKongConfig } from './commands/generate-kong-config';
import { validateService } from './commands/validate-service';
import { generateSecretsLocal } from './commands/generate-secrets-local';
import { generateDockerCompose } from './commands/generate-docker-compose';
import { sync } from './commands/sync';
import { addService } from './commands/add-service';
import { init } from './commands/init';
import type { InitCliArgs } from './commands/init';
import { removeService } from './commands/remove-service';
import { registerDetachedWorker } from './commands/register-detached-worker';
import { unregisterDetachedWorker } from './commands/unregister-detached-worker';
// Utilities
import { logger } from './utils/logger';
import { wrapCommand } from './utils/errors';
// Plugin context singleton
import { pluginContext } from './plugin';

// Read version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8'),
);

const program = new Command();

program
  .name('tsdevstack')
  .description('CLI tools for tsdevstack framework')
  .version(packageJson.version, '-v, --version', 'Output the current version');

program
  .command('generate-client [service-name]')
  .description('Generate TypeScript API client from OpenAPI spec')
  .option(
    '-i, --input <path>',
    'Path to OpenAPI spec file',
    './docs/openapi.json',
  )
  .option(
    '-m, --module-name-index <number>',
    'Module name index for version grouping',
    '1',
  )
  .action(
    wrapCommand(
      async (
        serviceName: string,
        options: { input: string; moduleNameIndex: string },
      ) => {
        await generateClient({
          input: options.input,
          moduleNameIndex: parseInt(options.moduleNameIndex, 10),
          serviceName,
        });
      },
    ),
  );

program
  .command('generate-kong')
  .description('Generate Kong gateway configuration')
  .action(
    wrapCommand(async () => {
      generateKongConfig();
    }),
  );

program
  .command('validate-service [service-name]')
  .description('Validate service follows naming conventions and structure')
  .action(
    wrapCommand(async (serviceName: string | undefined) => {
      await validateService(serviceName);
    }),
  );

program
  .command('generate-secrets')
  .description('Generate secrets for local development (three-file system)')
  .action(
    wrapCommand(async () => {
      generateSecretsLocal();
    }),
  );

program
  .command('generate-docker-compose')
  .description('Generate docker-compose.yml with injected secrets')
  .action(
    wrapCommand(async () => {
      generateDockerCompose();
    }),
  );

program
  .command('sync')
  .description(
    'Sync all infrastructure (secrets, docker-compose, kong, migrations)',
  )
  .action(
    wrapCommand(async () => {
      sync();
    }),
  );

program
  .command('init')
  .description('Create a new tsdevstack project')
  .option('-n, --name <name>', 'Project name')
  .option('-t, --template <template>', 'Template (empty, auth, fullstack-auth)')
  .option(
    '-f, --frontend-name <name>',
    'Frontend app name (for fullstack-auth)',
  )
  .action(
    wrapCommand(async (options: InitCliArgs) => {
      await init(options);
    }),
  );

program
  .command('add-service')
  .description('Add a new service to your project (SPA, Next.js, or NestJS)')
  .option('-n, --name <name>', 'Service name')
  .option('-t, --type <type>', 'Service type (spa, nextjs, nestjs)')
  .action(
    wrapCommand(async (options: { name?: string; type?: string }) => {
      await addService({
        name: options.name,
        type: options.type as 'spa' | 'nextjs' | 'nestjs' | undefined,
      });
    }),
  );

program
  .command('remove-service [service-name]')
  .description(
    'Remove a service from local project (delete files, update config)',
  )
  .option('--dry-run', 'Show what would be deleted without deleting')
  .action(
    wrapCommand(
      async (
        serviceName: string | undefined,
        options: { dryRun?: boolean },
      ) => {
        await removeService(serviceName, options);
      },
    ),
  );

program
  .command('register-detached-worker')
  .description(
    'Register a detached worker in config.json (no file scaffolding)',
  )
  .option('-n, --name <name>', 'Worker name')
  .option('-b, --base-service <service>', 'Base service name')
  .action(
    wrapCommand(async (options: { name?: string; baseService?: string }) => {
      await registerDetachedWorker(options);
    }),
  );

program
  .command('unregister-detached-worker')
  .description('Remove a detached worker entry from config.json')
  .option('-w, --worker <name>', 'Worker name')
  .action(
    wrapCommand(async (options: { worker?: string }) => {
      await unregisterDetachedWorker(options);
    }),
  );

// Initialize and register plugins
// cli-mcp stays external (in dependencies) — dynamic import is fine
const { initContext: initMcpContext, registerMcpPlugin } =
  await import('@tsdevstack/cli-mcp');

initContext(pluginContext);
initInfraContext(pluginContext);
initMcpContext(pluginContext);

registerCloudPlugin(program);
registerInfraPlugin(program);
registerMcpPlugin(program);

// Show help when no arguments provided
if (process.argv.length === 2) {
  program.help();
}

// Handle unknown commands
program.on('command:*', (operands) => {
  logger.newline();
  logger.error(`Unknown command: ${operands[0]}`);
  logger.newline();
  logger.info('Available commands:');
  program.commands.forEach((cmd) => {
    logger.info(`  - ${cmd.name()}`);
  });
  logger.newline();
  logger.info("Run 'tsdevstack --help' for more information.");
  process.exit(1);
});

program.parse();
