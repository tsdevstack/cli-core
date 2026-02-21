/**
 * Kong configuration utilities
 */

export * from './types';
export { resolveEnvVars, type JsonValue } from './resolve-env-vars';
export { getDefaultKongPlugins } from './default-plugins';
export { processCorsOrigins } from './process-cors-origins';
export { mergeKongConfigs } from './merge-kong-configs';
export {
  generateSecurityBasedServices,
  type ServiceRouteConfig,
} from './generate-security-routes';
export { generateJwtOidcPlugin } from './generate-jwt-oidc-plugin';
export { generateKeyAuthPlugin } from './generate-key-auth-plugin';