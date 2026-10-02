#!/usr/bin/env node

/**
 * Generate Kong Gateway configuration with 4-file (3+1) system (Phase 6)
 *
 * This script:
 * 1. Reads service configuration from .tsdevstack/config.json
 * 2. Parses OpenAPI specs from each service (apps/{service}/docs/openapi.json)
 * 3. Generates Kong services based on security metadata (public, JWT, partner)
 * 4. Creates kong.tsdevstack.yml (framework routes and global plugins, with placeholders)
 * 5. Creates/updates kong.user.yml (user customizations with placeholders)
 * 6. Merges framework + user configs
 * 7. Resolves placeholders with actual values from .secrets.local.json
 * 8. Writes final kong.yml (gitignored, has actual values)
 *
 * Escape Hatch:
 * - If kong.custom.yml exists, skip framework/user generation
 * - Only resolve placeholders from kong.custom.yml → kong.yml
 *
 * Security Types:
 * - Public routes: No authentication required
 * - JWT routes: Bearer token authentication via jwt-oidc plugin
 * - Partner routes: API keys checked by the tsdevstack-api-key plugin against
 *   Redis (exposed at /api prefix), behind a per-IP ceiling
 * Every route is exact (anchored path, OpenAPI methods plus OPTIONS).
 *
 * Files:
 * - kong.tsdevstack.yml: Framework routes (committed, auto-generated)
 * - kong.user.yml: User customizations (committed, user-owned)
 * - kong.custom.yml: Optional escape hatch (committed, user-created)
 * - kong.yml: Resolved config with actual values (gitignored)
 *
 * Usage: npx tsdevstack generate-kong
 */

import * as path from 'path';
import { loadLocalSecrets, getRequiredSecret } from '../utils/secrets';
import { logger } from '../utils/logger';
import { isFile, writeYamlFile, readYamlFile } from '../utils/fs';
import {
  resolveEnvVars,
  type KongTemplate,
  type JsonValue,
  getDefaultKongPlugins,
  processCorsOrigins,
} from '../utils/kong';
import { CliError } from '../utils/errors';
import { findProjectRoot } from '../utils/paths/find-project-root';
import {
  loadFrameworkConfig,
  hasAuthTemplate,
  resolveApiKeyIpLimit,
} from '../utils/config';
import { KONG_REDIS_HOST, KONG_LOCAL_BUILD_CONTEXT } from '../constants';
import { parseOpenApiSecurity } from '../utils/openapi';
import { generateSecurityBasedServices } from '../utils/kong/generate-security-routes';
import { type OperationContext } from '../utils/types/operation-context';
import { mergeKongConfigs } from '../utils/kong/merge-kong-configs';
import { buildFrameworkKongConfig } from '../utils/kong/build-framework-kong-config';
import { validateRequestTransformerHeaders } from '../utils/kong/validate-request-transformer-headers';
import { validateStripIdentityPlugin } from '../utils/kong/validate-strip-identity-plugin';
import { warnStaticPartnerConsumers } from '../utils/kong/warn-static-partner-consumers';
import { buildApiKeyDefaultLimits } from '../utils/kong/build-api-key-default-limits';
import type { PartnerApiSettings } from '../utils/kong/types';
import { writeLocalKongBuildContext } from '../utils/kong/write-local-kong-build-context';
import { resolveGlobalPrefix } from '../utils/config/resolve-global-prefix';

/**
 * Main generation function
 * @param _context - Optional operation context (for remove operations) - reserved for future use
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function generateKongConfig(_context?: OperationContext): void {
  // Note: _context parameter reserved for future operations (e.g., remove service cleanup)
  const rootDir = findProjectRoot();

  logger.generating('Generating Kong configuration (4-file/3+1 system)...');
  logger.newline();

  // Load config and secrets
  const config = loadFrameworkConfig();
  const secrets = loadLocalSecrets();

  // Override REDIS_HOST for Kong (runs in Docker, needs docker service name)
  secrets.REDIS_HOST = KONG_REDIS_HOST;

  // Check for kong.custom.yml (escape hatch)
  const customConfigPath = path.join(rootDir, 'kong.custom.yml');

  if (isFile(customConfigPath)) {
    // ESCAPE HATCH MODE: User has complete control
    logger.warn('kong.custom.yml detected - Using custom Kong configuration');
    logger.info('   Skipping framework route generation');
    logger.info('   Skipping kong.tsdevstack.yml generation');
    logger.info('   Skipping kong.user.yml generation');
    logger.info('   Only resolving ${ENV_VAR} placeholders...');
    logger.newline();

    // Read custom config
    const customConfig = readYamlFile(customConfigPath) as KongTemplate;
    validateStripIdentityPlugin(customConfig, 'kong.custom.yml');
    validateRequestTransformerHeaders(customConfig, 'kong.custom.yml');

    // Resolve placeholders
    const resolvedConfig = resolveEnvVars(
      customConfig as unknown as JsonValue,
      secrets,
    ) as unknown as KongTemplate;

    // Post-process CORS origins (if present)
    processCorsOrigins(resolvedConfig);

    // Write final kong.yml
    writeYamlFile(path.join(rootDir, 'kong.yml'), resolvedConfig);
    logger.success('Generated kong.yml from kong.custom.yml');
    logger.newline();

    writeLocalKongBuildContext(rootDir);

    logger.complete('Kong configuration generated (custom mode)!');
    logger.newline();
    logger.summary('Files:');
    logger.info('   - kong.custom.yml (your complete config, committed)');
    logger.info('   - kong.yml (resolved config, gitignored)');
    logger.newline();

    logger.info('To switch back to framework mode:');
    logger.info('   1. Rename kong.custom.yml to kong.custom.yml.backup');
    logger.info('   2. Run: npx tsdevstack generate-kong');
    logger.newline();

    return;
  }

  // NORMAL MODE: 3-file system (framework + user + merged)
  logger.info('Standard 3-file mode (no kong.custom.yml detected)');
  logger.newline();

  // Check template mode
  const useAuthTemplate = hasAuthTemplate(config);
  let authServiceUrl: string | undefined;
  let authServicePort: string | undefined;
  let authServicePrefix: string | undefined;

  if (useAuthTemplate) {
    // AUTH TEMPLATE MODE: Require auth-service for JWT validation
    logger.info('Auth template mode - using auth-service for JWT validation');
    logger.newline();

    const authService = config.services.find((s) => s.name === 'auth-service');
    if (!authService) {
      throw new CliError(
        'auth-service not found in framework config',
        'Kong configuration generation failed',
        'Add auth-service to .tsdevstack/config.json or set template: null for external OIDC',
      );
    }

    authServiceUrl = getRequiredSecret(
      secrets,
      'AUTH_SERVICE_URL',
      'AUTH_SERVICE_URL is required in .secrets.local.json',
    );

    authServicePort = new URL(authServiceUrl).port;
    if (!authServicePort) {
      throw new CliError(
        'AUTH_SERVICE_URL must include a port number (e.g., http://localhost:3001)',
        'Kong configuration generation failed',
        'Update AUTH_SERVICE_URL in .secrets.local.json to include port',
      );
    }

    authServicePrefix = authService.globalPrefix || 'auth';
    logger.success(`Found auth-service at ${authServiceUrl}`);
    logger.newline();
  } else {
    // NO AUTH TEMPLATE MODE: Use OIDC_DISCOVERY_URL for JWT validation
    logger.info('No auth template - routes will use external OIDC provider');
    logger.newline();
  }

  // Step 1: Parse OpenAPI specs for all NestJS services
  logger.info('Step 2: Parsing OpenAPI specs...');
  logger.newline();

  const parsedServices = [];

  for (const service of config.services) {
    if (service.type !== 'nestjs') {
      logger.info(`   Skipping ${service.name} (type: ${service.type})`);
      continue;
    }

    const openApiPath = path.join(
      rootDir,
      'apps',
      service.name,
      'docs',
      'openapi.json',
    );

    if (!isFile(openApiPath)) {
      logger.warn(`   Skipping ${service.name}: openapi.json not found`);
      continue;
    }

    try {
      const parsed = parseOpenApiSecurity(service.name, openApiPath);
      parsedServices.push({
        ...service,
        parsed,
      });
      logger.success(
        `   ${service.name}: ${parsed.groupedRoutes.public.length} public, ` +
          `${parsed.groupedRoutes.jwt.length} JWT, ${parsed.groupedRoutes.partner.length} partner routes`,
      );
    } catch (error) {
      logger.warn(
        `   Skipping ${service.name}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  if (parsedServices.length === 0) {
    throw new CliError(
      'No NestJS services with valid OpenAPI specs found',
      'Kong configuration generation failed',
      'Run "npm run docs:generate" to generate OpenAPI specs',
    );
  }

  logger.newline();

  // kong.user.yml is read (and created when missing) before the framework
  // config is built: the partner services' API key default limits come from
  // its global rate-limiting plugin.
  logger.info('Checking kong.user.yml...');
  const userConfigPath = path.join(rootDir, 'kong.user.yml');

  let userConfig: KongTemplate;

  if (!isFile(userConfigPath)) {
    logger.info('   kong.user.yml not found - creating template...');

    // User file: operational global plugins only (no services, no consumers)
    userConfig = {
      _format_version: '3.0',
      _transform: true,
      services: [],
      plugins: getDefaultKongPlugins(),
    };

    writeYamlFile(userConfigPath, userConfig);
    logger.success('Created kong.user.yml template');
  } else {
    logger.info('   kong.user.yml exists - using existing file');
    userConfig = readYamlFile(userConfigPath) as KongTemplate;
    validateRequestTransformerHeaders(userConfig, 'kong.user.yml');
    warnStaticPartnerConsumers(userConfig, 'kong.user.yml');
  }
  logger.newline();

  const partnerServices = parsedServices.filter(
    (service) => service.parsed.groupedRoutes.partner.length > 0,
  );
  const partnerApi: PartnerApiSettings = {
    defaultLimits:
      partnerServices.length > 0 ? buildApiKeyDefaultLimits(userConfig) : {},
    ipLimitPerMinute: resolveApiKeyIpLimit(config),
  };

  if (partnerServices.length > 0 && !useAuthTemplate) {
    logger.info(
      `@PartnerApi() routes in ${partnerServices.map((service) => service.name).join(', ')}, but no auth template: API keys must be written to Redis by your project (record format and key layout: API keys docs).`,
    );
    logger.newline();
  }

  // Step 3: Generate Kong services based on security metadata
  logger.info('Step 3: Generating Kong services...');
  logger.newline();

  const kongServices = [];

  for (const service of parsedServices) {
    const serviceUrlKey = `${service.name.toUpperCase().replace(/-/g, '_')}_URL`;
    const serviceUrl = secrets[serviceUrlKey] as string | undefined;

    if (!serviceUrl) {
      logger.warn(
        `   Skipping ${service.name}: ${serviceUrlKey} not found in secrets`,
      );
      continue;
    }

    // Extract port from service URL for Kong configuration
    const servicePort = new URL(serviceUrl).port;
    if (!servicePort) {
      logger.warn(
        `   Skipping ${service.name}: ${serviceUrlKey} must include a port number`,
      );
      continue;
    }

    // Use placeholder pattern: ${KONG_SERVICE_HOST}:PORT
    const kongServiceUrl = `\${KONG_SERVICE_HOST}:${servicePort}`;

    // Check for JWT routes without auth template
    const hasJwtRoutes = service.parsed.groupedRoutes.jwt.length > 0;
    if (hasJwtRoutes && !useAuthTemplate) {
      const oidcUrl = secrets.OIDC_DISCOVERY_URL as string | undefined;
      if (!oidcUrl) {
        logger.warn(
          `JWT routes detected in ${service.name} but no auth template configured.`,
        );
        logger.warn(
          'Set OIDC_DISCOVERY_URL in your secrets to enable JWT validation.',
        );
        logger.warn(
          'Example: https://your-domain.auth0.com/.well-known/openid-configuration',
        );
        logger.newline();
      }
    }

    const generatedServices = generateSecurityBasedServices({
      serviceName: service.name,
      serviceUrl: kongServiceUrl,
      globalPrefix: resolveGlobalPrefix(service),
      groupedRoutes: service.parsed.groupedRoutes,
      partnerApi,
      // Auth template mode: use auth service
      authServiceUrl: useAuthTemplate
        ? `\${KONG_SERVICE_HOST}:${authServicePort}`
        : undefined,
      authServicePrefix: useAuthTemplate ? authServicePrefix : undefined,
      // No auth template mode: use OIDC_DISCOVERY_URL placeholder
      oidcDiscoveryUrl: useAuthTemplate ? undefined : '${OIDC_DISCOVERY_URL}',
    });

    kongServices.push(...generatedServices);
    logger.success(
      `   ${service.name}: Generated ${generatedServices.length} Kong service(s)`,
    );
  }

  logger.newline();

  // Step 4: Build framework config (kong.tsdevstack.yml)
  logger.info('Step 4: Building framework config (kong.tsdevstack.yml)...');
  logger.newline();

  // Framework file: services and framework global plugins
  const tsdevstackConfig = buildFrameworkKongConfig(kongServices);

  // Write kong.tsdevstack.yml (ALWAYS regenerated)
  const tsdevstackPath = path.join(rootDir, 'kong.tsdevstack.yml');
  writeYamlFile(tsdevstackPath, tsdevstackConfig);
  logger.success(
    'Generated kong.tsdevstack.yml (framework routes + global plugins)',
  );
  logger.newline();

  // Step 7: Merge tsdevstack + user configs
  logger.info('Step 7: Merging configurations...');
  const mergedConfig = mergeKongConfigs(tsdevstackConfig, userConfig);
  logger.success('Merged framework routes with user customizations');
  logger.newline();

  // Step 8: Resolve ${ENV_VAR} placeholders
  logger.info('Step 8: Resolving ${ENV_VAR} placeholders...');
  logger.newline();

  const resolvedConfig = resolveEnvVars(
    mergedConfig as unknown as JsonValue,
    secrets,
  ) as unknown as KongTemplate;

  // Post-process CORS origins (convert comma-separated string to array)
  processCorsOrigins(resolvedConfig);

  logger.success('Resolved all environment variables');
  logger.newline();

  // Step 9: Write final kong.yml
  logger.info('Step 9: Writing kong.yml...');
  writeYamlFile(path.join(rootDir, 'kong.yml'), resolvedConfig);
  logger.success('Generated kong.yml (with actual secret values)');
  logger.newline();

  // Step 10: Write the local Kong image build context
  writeLocalKongBuildContext(rootDir);

  // Summary
  logger.complete('Kong configuration generated successfully!');
  logger.newline();
  logger.summary('Files:');
  logger.info('   - kong.tsdevstack.yml (framework routes, committed)');
  logger.info('   - kong.user.yml (your customizations, committed)');
  logger.info('   - kong.yml (merged + resolved, gitignored)');
  logger.info(
    `   - ${KONG_LOCAL_BUILD_CONTEXT}/Dockerfile (Kong image, regenerated)`,
  );
  logger.newline();

  logger.summary('Generated Kong services:');
  kongServices.forEach((service) => {
    logger.info(`   ${service.name}:`);
    service.routes.forEach((route) => {
      logger.info(
        `      ${(route.methods ?? []).join(',')} ${route.paths?.join(', ') ?? ''}`,
      );
    });
  });
  logger.newline();

  logger.summary('Next steps:');
  logger.info('   1. Review kong.user.yml and customize as needed');
  logger.info('   2. Run: npx tsdevstack sync');
  logger.newline();

  logger.info(
    'Need complete control? Create kong.custom.yml for escape hatch mode',
  );
  logger.newline();
}
