/**
 * Generate all framework services (Kong, Redis, DBs, pgAdmin)
 */

import type { FrameworkConfig } from '../../config';
import type { DockerComposeServices } from '../types';
import { logger } from '../../logger';
import {
  generateKongService,
  generateRedisService,
  generateRedisCommanderService,
  generateDatabaseService,
  generatePgAdminService,
  generatePrometheusService,
  generateGrafanaService,
  generateJaegerService,
} from '../generators';

export function generateFrameworkServices(
  config: FrameworkConfig,
  secrets: Record<string, string>
): DockerComposeServices {
  const services: DockerComposeServices = {};

  // Derive network name from project name
  const networkName = `${config.project.name}-network`;

  // 1. Kong Gateway
  logger.info('   ✓ Kong Gateway');
  Object.assign(services, generateKongService(networkName));

  // 2. Redis + Redis Commander
  logger.info('   ✓ Redis');
  Object.assign(services, generateRedisService(networkName));

  logger.info('   ✓ Redis Commander');
  Object.assign(services, generateRedisCommanderService(networkName));

  // 3. Database services
  let dbPortCounter = 5432;

  for (const service of config.services) {
    if (service.hasDatabase && service.databaseType === 'postgresql') {
      const dbName = service.name.replace(/-service$/, '');
      const prefix = dbName.replace(/-/g, '_').toUpperCase();

      // Get port from service config or auto-assign
      const dbPort = service.databasePort || dbPortCounter++;

      // Validate that secrets exist (they'll be loaded from .tsdevstack/env at runtime)
      const password = secrets[`${prefix}_DB_PASSWORD`];
      if (!password) {
        throw new Error(
          `Database password not found for ${service.name}. Run: npx tsdevstack generate-secrets`
        );
      }

      logger.info(`   ✓ ${dbName}-db (PostgreSQL on port ${dbPort})`);
      Object.assign(
        services,
        generateDatabaseService(service.name, dbPort, networkName)
      );
    }
  }

  // 4. pgAdmin (with all databases pre-configured)
  logger.info('   ✓ pgAdmin (http://localhost:5050, admin@localhost.com/admin)');
  Object.assign(services, generatePgAdminService(config.services, secrets, networkName));

  // 5. Prometheus + Grafana + Jaeger (monitoring & tracing)
  logger.info('   ✓ Prometheus (http://localhost:9090)');
  Object.assign(services, generatePrometheusService(networkName));

  logger.info('   ✓ Grafana (http://localhost:4001, admin/admin)');
  Object.assign(services, generateGrafanaService(networkName));

  logger.info('   ✓ Jaeger (http://localhost:16686)');
  Object.assign(services, generateJaegerService(networkName));

  return services;
}