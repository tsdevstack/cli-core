import { describe, it, expect } from '@rstest/core';
import { getFrameworkGlobalPlugins } from './get-framework-global-plugins';

describe('getFrameworkGlobalPlugins', () => {
  describe('Standard use cases', () => {
    it('should return tsdevstack-strip-identity, tsdevstack-client-ip and tsdevstack-trust', () => {
      expect(getFrameworkGlobalPlugins()).toEqual([
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
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should not include the service-level tsdevstack-api-prefix', () => {
      expect(getFrameworkGlobalPlugins().map((p) => p.name)).not.toContain(
        'tsdevstack-api-prefix',
      );
    });
  });
});
