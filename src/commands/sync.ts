#!/usr/bin/env node

/**
 * Sync command - Regenerate all infrastructure and run migrations
 *
 * This command:
 * 1. Regenerates secrets (preserving framework secrets: AUTH_SECRET, API_KEY)
 * 2. Regenerates docker-compose.yml
 * 3. Generates OpenAPI docs for NestJS services (needed by Kong)
 * 4. Regenerates kong.yaml
 * 5a. Starts critical infrastructure (DBs, Redis) and waits for health
 * 5b. Starts remaining containers (gateway, pgAdmin, user services) without waiting
 * 6. Recreates pgAdmin (without waiting) to reload configs and clear cache
 * 7. Runs Prisma migrations + generate for all services
 *
 * Usage: npx tsdevstack sync
 */

import { spawnSync } from 'child_process';
import { generateSecretsLocal } from './generate-secrets-local';
import { generateDockerCompose } from './generate-docker-compose';
import { generateKongConfig } from './generate-kong-config';
import {
  recreateContainers,
  composeUp,
  getDbServiceName,
} from '../utils/docker';
import { loadFrameworkConfig } from '../utils/config';
import { logger, printInfrastructureUrls } from '../utils/logger';
import {
  hasPrismaSchema,
  getDatabaseUrl,
  deployPrismaMigration,
  generatePrismaClient,
} from '../utils/prisma';
import { findProjectRoot } from '../utils/paths/find-project-root';
import { OperationContext } from '../utils/types/operation-context';

/**
 * Main sync function
 */
export function sync(context?: OperationContext): void {
  const rootDir = findProjectRoot();

  logger.syncing('Syncing tsdevstack infrastructure...');
  logger.newline();

  // Load config
  const config = loadFrameworkConfig();
  logger.loading(`Found ${config.services.length} services`);
  logger.newline();

  // Step 1: Generate secrets
  generateSecretsLocal(context);

  // Step 2: Generate docker-compose
  logger.newline();
  generateDockerCompose(context);

  // Step 3: Generate OpenAPI docs (needed by Kong)
  logger.newline();
  logger.generating('Generating OpenAPI docs...');
  const docsResult = spawnSync('npm', ['run', 'docs:generate'], {
    cwd: rootDir,
    stdio: 'pipe',
  });
  if (docsResult.status !== 0) {
    logger.warn(
      'OpenAPI docs generation had issues. Kong config may be incomplete.',
    );
  } else {
    logger.success('OpenAPI docs generated');
  }

  // Step 4: Generate Kong config
  logger.newline();
  generateKongConfig(context);

  // Step 5a: Start and wait for critical infrastructure (databases, redis)
  logger.newline();
  logger.updating('Starting critical infrastructure (databases, redis)...');

  const criticalServices = ['redis'];
  config.services.forEach((service) => {
    if (service.hasDatabase) {
      criticalServices.push(getDbServiceName(service.name));
    }
  });

  recreateContainers(criticalServices, rootDir, true);
  logger.success('Critical infrastructure ready');

  // Step 5b: Start all other containers (gateway, pgAdmin, user services) without waiting
  logger.newline();
  logger.updating('Starting remaining containers...');
  composeUp(rootDir, true, false);
  logger.success('All containers started');

  // Step 6: Recreate pgAdmin (without waiting) to clear cache and reload configs
  logger.newline();
  logger.updating('Recreating pgAdmin with fresh configs...');
  recreateContainers(['pgadmin'], rootDir, false);
  logger.success('pgAdmin recreated');

  // Run Prisma commands for services with databases
  logger.newline();
  logger.running('Running Prisma migrations...');

  const servicesWithPrisma = config.services.filter(
    (service) => service.hasDatabase && hasPrismaSchema(service.name),
  );

  if (servicesWithPrisma.length === 0) {
    logger.info('   No services with Prisma schemas found');
  } else {
    for (const service of servicesWithPrisma) {
      const databaseUrl = getDatabaseUrl(service.name);

      if (!databaseUrl) {
        logger.warn(
          `   Skipping ${service.name}: DATABASE_URL not found in secrets`,
        );
        continue;
      }

      logger.newline();
      logger.running(`Running Prisma commands for ${service.name}...`);

      logger.info('   Deploying migrations...');
      deployPrismaMigration(service.name, databaseUrl);

      logger.generating('   Generating Prisma client...');
      generatePrismaClient(service.name, databaseUrl);

      logger.success(`${service.name} Prisma commands completed`);
    }
  }

  logger.newline();
  logger.complete('Sync completed successfully!');
  logger.newline();
  logger.summary('Summary:');
  logger.success('Secrets regenerated (existing passwords preserved)');
  logger.success('Docker Compose regenerated');
  logger.success('OpenAPI docs generated');
  logger.success('Kong config regenerated');
  logger.success('All containers running and healthy');
  logger.success(
    `Prisma migrations run for ${servicesWithPrisma.length} service(s)`,
  );
  logger.newline();
  printInfrastructureUrls();
  logger.newline();
}
