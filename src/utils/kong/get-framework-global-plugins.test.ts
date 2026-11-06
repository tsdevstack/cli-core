import { describe, it, expect } from '@rstest/core';
import { getFrameworkGlobalPlugins } from './get-framework-global-plugins';

const TRACING = {
  tracesEndpoint: 'http://localhost:4318/v1/traces',
  sampleRate: 1,
};

describe('getFrameworkGlobalPlugins', () => {
  describe('Standard use cases', () => {
    it('should return tsdevstack-strip-identity, tsdevstack-client-ip, tsdevstack-trust and opentelemetry', () => {
      expect(getFrameworkGlobalPlugins(TRACING)).toEqual([
        { name: 'tsdevstack-strip-identity', config: {} },
        {
          name: 'tsdevstack-client-ip',
          config: {
            frontend_token: '${KONG_FRONTEND_TOKEN}',
            client_ip_header: 'X-Tsdevstack-Client-IP',
            token_header: 'X-Tsdevstack-Frontend-Token',
            real_ip_header: 'X-Tsdevstack-Real-IP',
            trace_headers: ['traceparent', 'tracestate', 'baggage'],
          },
        },
        {
          name: 'tsdevstack-trust',
          config: {
            token: '${KONG_TRUST_TOKEN}',
            header: 'X-Kong-Trust',
          },
        },
        {
          name: 'opentelemetry',
          config: {
            traces_endpoint: 'http://localhost:4318/v1/traces',
            sampling_rate: 1,
            resource_attributes: { 'service.name': 'kong' },
            propagation: {
              extract: ['w3c'],
              inject: ['w3c'],
              default_format: 'w3c',
            },
          },
        },
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should not include the service-level tsdevstack-api-prefix', () => {
      expect(
        getFrameworkGlobalPlugins(TRACING).map((p) => p.name),
      ).not.toContain('tsdevstack-api-prefix');
    });
  });
});
