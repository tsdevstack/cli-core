/**
 * Kong configuration types
 */

export interface KongRoute {
  name: string;
  paths?: string[];
  hosts?: string[];
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
