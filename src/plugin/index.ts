/**
 * Plugin Module
 *
 * Exports the context singleton and types for CLI plugins.
 * cli.ts imports pluginContext and passes it to plugins via initContext().
 * Plugins only import types (erased at runtime).
 */

// Context singleton - cli.ts imports this to pass to plugins
export { pluginContext } from './context';
export type { PluginContext } from './context';

// Re-export types for convenience
export type {
  // Config types
  FrameworkConfig,
  FrameworkService,
  CloudConfig,
  Environments,
  // Secrets types
  SecretsFile,
  Secrets,
  // Derived types
  Logger,
  CliErrorClass,
  CliErrorInstance,
  WrapCommand,
  // Cloud types
  CloudProvider,
  CloudProviders,
  GCPCredentials,
  GCPClientOptions,
  AWSCredentials,
  AzureCredentials,
  // OpenAPI types
  RouteSecurityInfo,
  SecurityType,
  OpenApiDocument,
  GroupedRoutes,
  ParsedServiceSecurity,
  // Kong types
  KongService,
  KongPlugin,
  KongConsumer,
  KongTemplate,
  KongUpstream,
  KongUpstreamTarget,
  ServiceRouteConfig,
  JsonValue,
} from './types';
