#!/usr/bin/env node

/**
 * Generate secrets for local development - Three-File System
 *
 * This command implements the three-file secrets approach:
 * 1. .secrets.tsdevstack.json - Regenerated BUT preserves framework secrets
 *    (AUTH_SECRET, API_KEY, DB credentials are preserved and auto-generated)
 * 2. .secrets.user.json - User-managed secrets (preserved if exists)
 * 3. .secrets.local.json - Merged result (ALWAYS regenerated)
 *
 * Usage: npx tsdevstack generate-secrets
 *
 * Credentials for local development:
 *   PostgreSQL: Each service gets unique generated credentials (preserved across runs)
 *   Redis: redis_pass (hardcoded for local dev)
 *
 * See docs/dev/secrets-architecture.md for detailed documentation
 */

import path from 'node:path';
import {
  type SecretsFile,
  generateFrameworkSecretsFile,
  generateUserSecretsFile,
  generateUserSecretsExample,
  syncUserSecretsStructure,
  mergeSecrets,
  loadFrameworkSecrets as loadFrameworkSecretsFile,
  loadUserSecrets as loadUserSecretsFile,
  writeSecretsFile,
  generateEnvFile,
  generateNextjsEnvFiles,
  generateBackendEnvFiles,
  generateSpaEnvFiles,
  toScreamingSnakeCase,
  deepDeleteServiceReferences,
  generateSecretMap,
} from '../utils/secrets';
import { loadFrameworkConfig } from '../utils/config';
import { logger } from '../utils/logger';
import { writeJsonFile } from '../utils/fs';
import { findProjectRoot } from '../utils/paths';
import {
  FRAMEWORK_SECRETS_FILE,
  USER_SECRETS_FILE,
  LOCAL_SECRETS_FILE,
  TSDEVSTACK_DIR,
  SECRET_MAP_FILENAME,
} from '../constants';
import type { OperationContext } from '../utils/types/operation-context';

/**
 * Generate secrets for all services - Three-File Approach
 */
export function generateSecretsLocal(context?: OperationContext): void {
  logger.generating('Generating secrets (three-file system)...');
  logger.newline();

  // Step 1: Load framework config
  const config = loadFrameworkConfig();
  logger.loading(`Loaded config: ${config.services.length} services`);
  logger.newline();

  // Step 2: Load existing framework secrets (to preserve AUTH_SECRET, API_KEY)
  const existingFrameworkSecrets = loadFrameworkSecretsFile();
  if (existingFrameworkSecrets) {
    logger.loading('Loading existing framework secrets...');
    logger.info(
      '   Preserving existing framework secrets (AUTH_SECRET, API_KEY)',
    );
    logger.newline();
  }

  // Step 3: Generate .secrets.tsdevstack.json (regenerated but preserves framework secrets)
  logger.generating(`Generating ${FRAMEWORK_SECRETS_FILE}...`);
  const frameworkSecrets = generateFrameworkSecretsFile(
    config,
    existingFrameworkSecrets,
  );
  writeSecretsFile(FRAMEWORK_SECRETS_FILE, frameworkSecrets);
  logger.success(
    'Generated framework secrets (AUTH_SECRET, API_KEY, DB credentials, redis_pass)',
  );

  // Generate or preserve .secrets.user.json
  let userSecrets = loadUserSecretsFile();

  if (userSecrets) {
    logger.newline();
    logger.checking(`Checking ${USER_SECRETS_FILE}...`);
    logger.info('   File exists, preserving user edits');

    // Handle remove operation on user secrets
    if (context?.operation === 'remove' && context.removedService) {
      logger.updating(`Removing service secrets: ${context.removedService}...`);

      // Use deep delete to handle entire secrets structure
      const { modified, result } = deepDeleteServiceReferences(
        userSecrets,
        context.removedService,
      );

      if (modified) {
        userSecrets = result as SecretsFile;
        writeSecretsFile(USER_SECRETS_FILE, userSecrets);

        const upperName = toScreamingSnakeCase(context.removedService);
        logger.success(
          `Removed all service references: ${context.removedService}`,
        );
        logger.success(`Deleted uppercase env vars: ${upperName}_*`);
      }
    }

    // Sync structure (add new services if any)
    const synced = syncUserSecretsStructure(userSecrets, config);
    if (synced) {
      userSecrets = synced;
      writeSecretsFile(USER_SECRETS_FILE, userSecrets);
      logger.success('Added new services to user secrets structure');
    } else {
      logger.success('Structure is up-to-date');
    }
  } else {
    logger.newline();
    logger.generating(`Generating ${USER_SECRETS_FILE}...`);
    userSecrets = generateUserSecretsFile(config);
    writeSecretsFile(USER_SECRETS_FILE, userSecrets);
    logger.success('Generated user secrets with defaults');
    logger.info('   ALLOWED_ORIGINS auto-detected from frontend services');
  }

  // Step 3.5: Generate .secrets.user.example.json (for git)
  logger.newline();
  logger.generating('Generating .secrets.user.example.json...');
  const userSecretsExample = generateUserSecretsExample(userSecrets);
  writeSecretsFile('.secrets.user.example.json', userSecretsExample);
  logger.success('Generated example file (commit this to git)');

  // Step 4: Generate secret-map.json (committed to git, used by deploy commands in CI)
  logger.newline();
  logger.generating('Generating secret-map.json...');
  const secretMap = generateSecretMap(frameworkSecrets, userSecrets, config);
  writeJsonFile(
    path.join(findProjectRoot(), TSDEVSTACK_DIR, SECRET_MAP_FILENAME),
    secretMap,
  );
  logger.success(
    `Generated secret map for ${Object.keys(secretMap).length} services`,
  );

  // Step 5: Merge framework + user → local
  logger.newline();
  logger.generating(`Generating ${LOCAL_SECRETS_FILE}...`);
  const merged = mergeSecrets(frameworkSecrets, userSecrets);

  // Add metadata to merged file
  const localSecrets: SecretsFile = {
    $comment: 'AUTO-GENERATED - DO NOT EDIT THIS FILE',
    $warning: "This file is regenerated by 'npx tsdevstack generate-secrets'",
    $edit_instead: `Edit ${USER_SECRETS_FILE} for custom values`,
    $regenerate: 'Safe to delete - will be recreated automatically',
    $generated_at: new Date().toISOString(),
    $source: `Merged from ${FRAMEWORK_SECRETS_FILE} + ${USER_SECRETS_FILE}`,
    ...merged,
  };

  writeSecretsFile(LOCAL_SECRETS_FILE, localSecrets);
  logger.success('Merged framework + user secrets');

  // Step 5: Generate .env for Docker/Kong
  logger.newline();
  logger.generating('Generating .env for Docker/Kong...');
  generateEnvFile();

  // Step 6: Generate .env files for Next.js apps
  logger.newline();
  logger.generating('Generating .env files for Next.js apps...');
  generateNextjsEnvFiles(config);

  // Step 7: Generate .env files for SPA apps
  logger.newline();
  logger.generating('Generating .env files for SPA apps...');
  generateSpaEnvFiles(config);

  // Step 8: Generate .env files for backend services (Prisma Studio)
  logger.newline();
  logger.generating('Generating .env files for backend services...');
  generateBackendEnvFiles(config);

  // Summary
  logger.newline();
  logger.complete('Secrets generation complete!');
  logger.newline();
  logger.summary('Summary:');
  logger.success(`${FRAMEWORK_SECRETS_FILE} - Auto-generated (safe to delete)`);
  logger.success(`${USER_SECRETS_FILE} - Your custom secrets (edit this)`);
  logger.success(`${LOCAL_SECRETS_FILE} - Merged result (apps read this)`);
  logger.newline();
  logger.info('Files generated:');
  logger.info(
    `   - Framework secrets: ${Object.keys(frameworkSecrets.secrets).length}`,
  );
  logger.info(`   - Services configured: ${config.services.length}`);
  logger.newline();
  logger.warn('Important:');
  logger.info('   - All three files are gitignored (never commit!)');
  logger.info(`   - Edit ${USER_SECRETS_FILE} to add custom secrets`);
  logger.info('   - Run this command again after editing to re-merge');
  logger.info('   - Restart your services to pick up new secrets');
  logger.newline();
}
