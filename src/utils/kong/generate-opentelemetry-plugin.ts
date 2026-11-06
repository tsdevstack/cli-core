/**
 * Generate Kong's opentelemetry plugin (framework global plugin)
 */

import { KONG_OPENTELEMETRY_PLUGIN_NAME } from '../../constants';
import type { OpenTelemetryPluginConfig } from './plugin-types';

export interface KongTracingOptions {
  /** OTLP/HTTP traces URL: KONG_LOCAL_TRACES_ENDPOINT or KONG_CLOUD_TRACES_ENDPOINT */
  tracesEndpoint: string;
  /** Share of new traces kept (tracing.sampleRate of the environment) */
  sampleRate: number;
}

/**
 * Kong is the first hop of an API request: it decides whether the request is
 * traced and passes the trace on in a W3C traceparent, which the services
 * follow. A trace from our frontend continues (tsdevstack-client-ip drops
 * trace headers from everyone else before this plugin reads them).
 */
export function generateOpenTelemetryPlugin(
  options: KongTracingOptions,
): OpenTelemetryPluginConfig {
  return {
    name: KONG_OPENTELEMETRY_PLUGIN_NAME,
    config: {
      traces_endpoint: options.tracesEndpoint,
      sampling_rate: options.sampleRate,
      resource_attributes: { 'service.name': 'kong' },
      propagation: {
        extract: ['w3c'],
        // The services and the frontend speak W3C only
        inject: ['w3c'],
        default_format: 'w3c',
      },
    },
  };
}
