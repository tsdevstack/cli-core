/**
 * Generate Kong's tracing plugin, tsdevstack-opentelemetry (framework global plugin)
 */

import {
  KONG_OPENTELEMETRY_PLUGIN_NAME,
  KONG_TRACEPARENT_COPY_HEADER,
} from '../../constants';
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
 * follow. A trace from our frontend continues with the frontend's decision:
 * one it sampled is kept whatever the rate, one it did not is dropped
 * (tsdevstack-client-ip drops trace headers from everyone else before this
 * plugin reads them).
 *
 * The trace travels in KONG_TRACEPARENT_COPY_HEADER too: the frontend's
 * copy is what Kong continues, and Kong sends the services a copy of its
 * traceparent, so a platform that rewrites traceparent on the way (Cloud
 * Run) changes no decision.
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
      traceparent_copy_header: KONG_TRACEPARENT_COPY_HEADER,
    },
  };
}
