/**
 * Kong configuration types
 */

import type { GroupedRoutes } from '../openapi';
import type { ApiKeyDefaultLimits } from './plugin-types';

export interface KongRoute {
  name: string;
  paths?: string[];
  hosts?: string[];
  /** HTTP methods the route matches (all methods when omitted) */
  methods?: string[];
  /** Order among regex routes matching the same request (higher wins) */
  regex_priority?: number;
  strip_path: boolean;
  /** Preserve original Host header from client request */
  preserve_host?: boolean;
}

export interface KongService {
  name: string;
  url: string;
  routes: KongRoute[];
  plugins?: KongPlugin[];
}

export interface KongPlugin {
  name: string;
  /** Kong default: true */
  enabled?: boolean;
  config: {
    origins?: string[] | string;
    [key: string]: unknown;
  };
}

export interface KongConsumer {
  username: string;
  keyauth_credentials?: Array<{
    key: string;
  }>;
  plugins?: KongPlugin[];
}

export interface KongTemplate {
  _format_version?: string;
  _transform?: boolean;
  services: KongService[];
  consumers?: KongConsumer[];
  plugins?: KongPlugin[];
  upstreams?: KongUpstream[];
}

export interface KongUpstreamTarget {
  target: string;
  weight: number;
  tags?: string[];
}

export interface KongUpstream {
  name: string;
  algorithm: string;
  /** Host header to send to targets (for ALB host-based routing) */
  host_header?: string;
  healthchecks: {
    active: {
      type: string;
      http_path: string;
      https_verify_certificate: boolean;
      /** Headers to send with health check requests (e.g., Host header for ALB routing) */
      headers?: Record<string, string[]>;
      healthy: {
        interval: number;
        successes: number;
        http_statuses: number[];
      };
      unhealthy: {
        interval: number;
        http_failures: number;
        tcp_failures: number;
        timeouts: number;
        http_statuses: number[];
      };
    };
    passive: {
      healthy: {
        successes: number;
        http_statuses: number[];
      };
      unhealthy: {
        http_failures: number;
        tcp_failures: number;
        timeouts: number;
        http_statuses: number[];
      };
    };
  };
  targets: KongUpstreamTarget[];
}

/**
 * Settings of the plugins on every partner service
 */
export interface PartnerApiSettings {
  /** tsdevstack-api-key `default_limits` (from the global rate-limiting) */
  defaultLimits: ApiKeyDefaultLimits;
  /** Per-IP ceiling (requests per minute per client IP) */
  ipLimitPerMinute: number;
}

export interface ServiceRouteConfig {
  serviceName: string;
  serviceUrl: string;
  /**
   * The service's global route prefix. OpenAPI paths already start with it;
   * paths outside it are reported with a warning.
   */
  globalPrefix: string;
  groupedRoutes: GroupedRoutes;
  /** Key plugin and per-IP ceiling settings for the partner service */
  partnerApi: PartnerApiSettings;
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
