/**
 * Plugin Interface Types
 *
 * Standard types for CLI plugins (cli-cloud-secrets, cli-infra, etc.)
 * This file re-exports existing types - no duplication.
 *
 * Note: PluginContext type is derived from the actual context object in context.ts
 */

// Re-export config types
export type {
  FrameworkConfig,
  FrameworkService,
  CloudConfig,
  Environments,
} from '../utils/config/types';

// Re-export secrets types
export type { SecretsFile, Secrets } from '../utils/secrets/types';

// Cloud providers constant and derived type
import { CLOUD_PROVIDERS } from '../constants';
export type CloudProviders = typeof CLOUD_PROVIDERS;

// Derive Logger type from actual implementation
import { logger } from '../utils/logger/logger';
export type Logger = typeof logger;

// Derive CliError types from actual implementation
import { CliError } from '../utils/errors/cli-error';
export type CliErrorClass = typeof CliError;
export type CliErrorInstance = InstanceType<typeof CliError>;

// Derive wrapCommand type from actual implementation
import { wrapCommand } from '../utils/errors/wrap-command';
export type WrapCommand = typeof wrapCommand;

// Re-export cloud types
export type {
  CloudProvider,
  GCPCredentials,
  GCPClientOptions,
  AWSCredentials,
  AzureCredentials,
} from '../utils/cloud/types';

// Re-export OpenAPI types
export type {
  RouteSecurityInfo,
  SecurityType,
  OpenApiDocument,
} from '../utils/openapi/types';
export type { GroupedRoutes } from '../utils/openapi/group-routes-by-security';
export type { ParsedServiceSecurity } from '../utils/openapi/parse-openapi-security';

// Re-export Kong types
export type {
  KongService,
  KongPlugin,
  KongConsumer,
  KongTemplate,
  KongUpstream,
  KongUpstreamTarget,
} from '../utils/kong/types';
export type { ServiceRouteConfig } from '../utils/kong/generate-security-routes';
export type { JsonValue } from '../utils/kong/resolve-env-vars';
