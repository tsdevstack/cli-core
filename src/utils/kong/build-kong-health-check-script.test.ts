import { describe, it, expect } from '@rstest/core';
import { buildKongHealthCheckScript } from './build-kong-health-check-script';

describe('buildKongHealthCheckScript', () => {
  describe('Standard use cases', () => {
    it('should check Kong readiness only', () => {
      const result = buildKongHealthCheckScript();
      expect(result).toContain('/usr/local/bin/kong-health-check.sh');
      expect(result).toContain('localhost:8100/status/ready');
    });

    it('should not wait for OIDC discovery or wake any service', () => {
      const result = buildKongHealthCheckScript();
      expect(result).not.toContain('openid-configuration');
      expect(result).not.toContain('WAKEUP_LAMBDA_URL');
      expect(result).not.toContain('WAKEUP_SECRET');
    });
  });

  describe('Edge cases', () => {
    it('should end with chmod so the script is executable', () => {
      expect(buildKongHealthCheckScript().trimEnd()).toMatch(
        /chmod \+x \/usr\/local\/bin\/kong-health-check\.sh$/,
      );
    });
  });
});
