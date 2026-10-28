import { describe, it, expect } from '@rstest/core';
import { buildFrameworkKongConfig } from './build-framework-kong-config';
import type { KongService } from './types';

const service: KongService = {
  name: 'offers-service-public',
  url: 'http://offers:3002',
  routes: [{ name: 'r', paths: ['~/offers/v1/x$'], strip_path: false }],
};

describe('buildFrameworkKongConfig', () => {
  describe('Standard use cases', () => {
    it('should hold the services and the framework global plugins', () => {
      expect(buildFrameworkKongConfig([service])).toEqual({
        _format_version: '3.0',
        _transform: true,
        services: [service],
        plugins: [
          { name: 'tsdevstack-strip-identity', config: {} },
          {
            name: 'tsdevstack-client-ip',
            config: {
              frontend_token: '${KONG_FRONTEND_TOKEN}',
              client_ip_header: 'X-Tsdevstack-Client-IP',
              token_header: 'X-Tsdevstack-Frontend-Token',
              real_ip_header: 'X-Tsdevstack-Real-IP',
            },
          },
          {
            name: 'tsdevstack-trust',
            config: {
              token: '${KONG_TRUST_TOKEN}',
              header: 'X-Kong-Trust',
            },
          },
        ],
      });
    });
  });

  describe('Edge cases', () => {
    it('should keep the framework plugins without services', () => {
      const config = buildFrameworkKongConfig([]);

      expect(config.services).toEqual([]);
      expect(config.plugins).toHaveLength(3);
    });
  });
});
