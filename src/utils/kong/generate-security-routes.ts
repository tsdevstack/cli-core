/**
 * Generates Kong services and routes based on security types
 */

import type { KongService } from "./types";
import type { GroupedRoutes } from "../openapi";
import { extractUniquePaths } from "../openapi";
import { generateJwtOidcPlugin } from "./generate-jwt-oidc-plugin";
import { generateKeyAuthPlugin } from "./generate-key-auth-plugin";

export interface ServiceRouteConfig {
  serviceName: string;
  serviceUrl: string;
  globalPrefix: string;
  groupedRoutes: GroupedRoutes;
  /**
   * Auth service URL (for auth template mode).
   * Used with authServicePrefix to construct OIDC discovery URL.
   */
  authServiceUrl?: string;
  /**
   * Auth service global prefix (for auth template mode).
   */
  authServicePrefix?: string;
  /**
   * Direct OIDC discovery URL (for no-auth template mode).
   * Takes precedence over authServiceUrl/authServicePrefix if set.
   */
  oidcDiscoveryUrl?: string;
}

/**
 * Generates Kong services (up to 3: public, JWT, partner) for a single backend service.
 *
 * @param config - Service route configuration
 * @returns Array of Kong service definitions
 */
export function generateSecurityBasedServices(
  config: ServiceRouteConfig
): KongService[] {
  const services: KongService[] = [];

  // 1. Public routes (if any)
  if (config.groupedRoutes.public.length > 0) {
    services.push(generatePublicService(config));
  }

  // 2. JWT-protected routes (if any)
  if (config.groupedRoutes.jwt.length > 0) {
    services.push(generateJwtService(config));
  }

  // 3. Partner API routes (if any)
  if (config.groupedRoutes.partner.length > 0) {
    services.push(generatePartnerService(config));
  }

  return services;
}

/**
 * Generates Kong service for public routes (no authentication).
 *
 * @param config - Service route configuration
 * @returns Kong service definition for public routes
 */
function generatePublicService(config: ServiceRouteConfig): KongService {
  const paths = extractUniquePaths(config.groupedRoutes.public);

  // Public routes: paths already include global prefix from OpenAPI
  const publicPaths = paths;

  return {
    name: `${config.serviceName}-public`,
    url: config.serviceUrl,
    routes: [
      {
        name: `${config.serviceName}-public-route`,
        paths: publicPaths,
        strip_path: false,
      },
    ],
  };
}

/**
 * Generates Kong service for JWT-protected routes.
 *
 * @param config - Service route configuration
 * @returns Kong service definition for JWT routes
 */
function generateJwtService(config: ServiceRouteConfig): KongService {
  const paths = extractUniquePaths(config.groupedRoutes.jwt);

  // JWT routes: paths already include global prefix from OpenAPI
  const jwtPaths = paths;

  const jwtPlugin = generateJwtOidcPlugin({
    discoveryUrl: config.oidcDiscoveryUrl,
    authServiceUrl: config.authServiceUrl,
    authServicePrefix: config.authServicePrefix,
  });

  return {
    name: `${config.serviceName}-jwt`,
    url: config.serviceUrl,
    routes: [
      {
        name: `${config.serviceName}-jwt-route`,
        paths: jwtPaths,
        strip_path: false,
      },
    ],
    plugins: [jwtPlugin],
  };
}

/**
 * Generates Kong service for partner API routes (API key authentication).
 *
 * Partner API routing uses prefix-based matching:
 * - External URL: /api/offers/v1/plans (client calls this)
 * - Route path: /api/offers (prefix match)
 * - strip_path removes: /api/offers
 * - Service URL path: /offers (globalPrefix added to URL)
 * - Backend receives: /offers/v1/plans (service path + remaining request path)
 *
 * @param config - Service route configuration
 * @returns Kong service definition for partner routes
 */
function generatePartnerService(config: ServiceRouteConfig): KongService {
  // Partner routes use prefix-based matching with globalPrefix
  // External: /api/{globalPrefix}/* → Backend: /{globalPrefix}/*
  const partnerPath = `/api/${config.globalPrefix}`;

  const keyAuthPlugin = generateKeyAuthPlugin();

  // Service URL includes globalPrefix in path
  // Kong prepends this to the remaining request path after strip_path
  const serviceUrlWithPrefix = `${config.serviceUrl}/${config.globalPrefix}`;

  return {
    name: `${config.serviceName}-partner`,
    url: serviceUrlWithPrefix,
    routes: [
      {
        name: `${config.serviceName}-partner-route`,
        paths: [partnerPath],
        strip_path: true,
      },
    ],
    plugins: [keyAuthPlugin],
  };
}