#!/usr/bin/env node

/**
 * Generate Docker Compose configuration with environment variable placeholders
 *
 * This script:
 * 1. Reads .tsdevstack/config.json to discover services
 * 2. Dynamically generates framework services (Kong, Redis, DBs, pgAdmin)
 * 3. Uses ${ENV_VAR} placeholders for secrets (loaded from .env)
 * 4. Validates secrets exist in .secrets.local.json
 * 5. Writes docker-compose.yml (safe to commit - no secrets baked in)
 * 6. Includes docker-compose.user.yml for user custom services
 *
 * Usage: npx tsdevstack generate-docker-compose
 */

import * as path from 'path';
import { loadLocalSecrets } from '../utils/secrets';
import { loadFrameworkConfig } from '../utils/config';
import { logger } from '../utils/logger';
import { writeYamlFile } from '../utils/fs';
import {
  generateFrameworkServices,
  generateUserComposeTemplate,
  writePgAdminConfigs,
  writeMonitoringConfigs,
} from '../utils/docker/compose';
import { findProjectRoot } from '../utils/paths/find-project-root';
import { OperationContext } from '../utils/types/operation-context';

/**
 * Main generation function
 */
export function generateDockerCompose(context?: OperationContext): void {
  const rootDir = findProjectRoot();
  const outputPath = path.join(rootDir, 'docker-compose.yml');

  logger.generating('Generating docker-compose.yml...');
  logger.newline();

  // Handle context operations (informational only - docker-compose regenerates from config)
  if (context?.operation === 'remove' && context.removedService) {
    logger.info(
      `   Removing service: ${context.removedService} (will be excluded from generated config)`,
    );
  }

  // Load framework config
  logger.loading('Loading framework config...');
  const config = loadFrameworkConfig();

  // Load secrets (with DB password extraction enabled)
  logger.loading('Loading secrets...');
  const secrets = loadLocalSecrets(true);

  // Generate framework services
  logger.newline();
  logger.running('Generating framework-managed services:');
  logger.newline();
  const frameworkServices = generateFrameworkServices(config, secrets);

  const networkName = `${config.project.name}-network`;

  // Build complete docker-compose structure
  const composeConfig = {
    name: config.project.name,
    services: frameworkServices,
    networks: {
      [networkName]: {
        driver: 'bridge',
      },
    },
    volumes: {
      db_data: null,
      redis_data: null,
    },
    include: [
      {
        path: 'docker-compose.user.yml',
        required: false,
      },
    ],
  };

  // Write output
  writeYamlFile(outputPath, composeConfig);

  // Write pgAdmin configuration files
  writePgAdminConfigs(rootDir, config.services, secrets);

  // Write Prometheus and Grafana configuration files
  writeMonitoringConfigs(rootDir, config);

  // Generate docker-compose.user.yml template if it doesn't exist
  logger.newline();
  logger.checking('Checking docker-compose.user.yml...');
  logger.newline();
  generateUserComposeTemplate(rootDir, networkName);

  // Summary
  logger.newline();
  logger.complete('Generated docker-compose.yml successfully!');
  logger.newline();
  logger.summary('Framework services configured:');
  logger.info('   - Kong Gateway (proxy: 8000, admin: 8001)');
  logger.info('   - Redis (port: 6379)');
  logger.info('   - Redis Commander (http://localhost:8081)');

  const dbServices = config.services.filter((s) => s.hasDatabase);
  if (dbServices.length > 0) {
    logger.info(`   - PostgreSQL databases (${dbServices.length}):`);
    let dbPortCounter = 5432;
    dbServices.forEach((s) => {
      const dbName = s.name.replace(/-service$/, '');
      const dbPort = s.databasePort || dbPortCounter++;
      logger.info(`     • ${dbName}-db (port ${dbPort})`);
    });
  }

  logger.info('   - pgAdmin (http://localhost:5050)');
  logger.info('     Email: admin@localhost.com');
  logger.info('     Password: admin');
  logger.info('   - Prometheus (http://localhost:9090)');
  logger.info('   - Grafana (http://localhost:4001)');
  logger.info('     User: admin');
  logger.info('     Password: admin');
  logger.newline();

  logger.summary('Next steps:');
  logger.info('   1. Run: docker compose up -d');
  logger.info('   2. Check services: docker compose ps');
  logger.info('   3. Access Grafana: http://localhost:4001');
  logger.newline();

  logger.warn('Remember:');
  logger.info(
    '   - docker-compose.yml can be committed (uses env vars, no secrets)',
  );
  logger.info('   - Secrets loaded from .env (gitignored, auto-generated)');
  logger.info(
    '   - Add custom services to docker-compose.user.yml (committed, editable)',
  );
  logger.newline();
}
