/**
 * Plugin Context Singleton
 *
 * Created once when cli-core loads, used by all plugins.
 * Plugins import useContext to access these utilities.
 */

// Core utilities
import { logger } from '../utils/logger';
import { loadFrameworkConfig, hasAuthTemplate } from '../utils/config';
import {
  readJsonFile,
  writeJsonFile,
  readYamlFile,
  isFile,
  ensureDirectory,
  writeTextFile,
  deleteFile,
  cleanupFolder,
} from '../utils/fs';
import {
  findProjectRoot,
  getConfigPath,
  getCredentialsPath,
} from '../utils/paths';
import { CliError, wrapCommand } from '../utils/errors';

// Constants
import {
  TSDEVSTACK_DIR,
  SECRET_MAP_FILENAME,
  CLOUD_PROVIDERS,
  GCP_DATABASE_CONNECTION_LIMITS,
  DEFAULT_DATABASE_TIER,
  AWS_DATABASE_CONNECTION_LIMITS,
  DEFAULT_AWS_DATABASE_TIER,
  AZURE_DATABASE_CONNECTION_LIMITS,
  DEFAULT_AZURE_DATABASE_TIER,
} from '../constants';

// Credentials utilities
import {
  loadCredentialsFile,
  getAvailableEnvironments,
  getGCPCredentialsFromEnv,
  getAWSCredentialsFromEnv,
  getAzureCredentialsFromEnv,
  resolveCredentials,
  buildGCPClientOptions,
} from '../utils/credentials';

// CI utilities
import { isCIEnv } from '../utils/ci';

// Environment utilities
import { resolveEnvironment } from '../utils/environment';

// Validation utilities
import { validateDuplicateCredentials } from '../utils/validation';

// Secrets utilities
import { generateFrameworkSecretsFile } from '../utils/secrets/generate-framework-secrets-file';
import { loadUserSecrets } from '../utils/secrets/load-user-secrets';
import { loadFrameworkSecrets } from '../utils/secrets/load-framework-secrets';
import { generateServiceUrls } from '../utils/secrets/generate-service-urls';
import { buildSecretName } from '../utils/secrets/build-secret-name';

// Exec utilities
import { executeCommand } from '../utils/exec';

// OpenAPI utilities
import { parseOpenApiSecurity } from '../utils/openapi';
import { extractUniquePaths } from '../utils/openapi/extract-unique-paths';

// Kong utilities
import {
  mergeKongConfigs,
  generateSecurityBasedServices,
  resolveEnvVars,
  generateJwtOidcPlugin,
  generateKeyAuthPlugin,
  processCorsOrigins,
} from '../utils/kong';

/**
 * Singleton context - created once, used by all plugins
 */
export const pluginContext = {
  // Core utilities
  logger,
  loadFrameworkConfig,
  hasAuthTemplate,
  readJsonFile,
  writeJsonFile,
  readYamlFile,
  isFile,
  ensureDirectory,
  writeTextFile,
  deleteFile,
  cleanupFolder,
  findProjectRoot,
  getConfigPath,

  // Constants
  TSDEVSTACK_DIR,
  SECRET_MAP_FILENAME,
  CLOUD_PROVIDERS,
  GCP_DATABASE_CONNECTION_LIMITS,
  DEFAULT_DATABASE_TIER,
  AWS_DATABASE_CONNECTION_LIMITS,
  DEFAULT_AWS_DATABASE_TIER,
  AZURE_DATABASE_CONNECTION_LIMITS,
  DEFAULT_AZURE_DATABASE_TIER,

  // Error handling
  CliError,
  wrapCommand,

  // Cloud utilities
  getCredentialsPath,
  loadCredentialsFile,
  getAvailableEnvironments,
  validateDuplicateCredentials,
  getGCPCredentialsFromEnv,
  getAWSCredentialsFromEnv,
  getAzureCredentialsFromEnv,
  resolveCredentials,
  buildGCPClientOptions,

  // CI utilities
  isCIEnv,

  // Environment utilities
  resolveEnvironment,

  // Secrets utilities
  generateFrameworkSecretsFile,
  loadUserSecrets,
  loadFrameworkSecrets,
  generateServiceUrls,
  buildSecretName,

  // Exec utilities
  executeCommand,

  // OpenAPI utilities
  parseOpenApiSecurity,
  extractUniquePaths,

  // Kong utilities
  mergeKongConfigs,
  generateSecurityBasedServices,
  resolveEnvVars,
  generateJwtOidcPlugin,
  generateKeyAuthPlugin,
  processCorsOrigins,
} as const;

export type PluginContext = typeof pluginContext;
