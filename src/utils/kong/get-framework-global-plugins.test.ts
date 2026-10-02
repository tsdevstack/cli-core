import { describe, it, expect } from '@rstest/core';
import { getFrameworkGlobalPlugins } from './get-framework-global-plugins';

describe('getFrameworkGlobalPlugins', () => {
  describe('Standard use cases', () => {
    it('should return tsdevstack-strip-identity', () => {
      expect(getFrameworkGlobalPlugins()).toEqual([
        { name: 'tsdevstack-strip-identity', config: {} },
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
