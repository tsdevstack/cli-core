import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('../logger', () => ({
  logger: { warn: rs.fn() },
}));

import { validateStripIdentityPlugin } from './validate-strip-identity-plugin';
import { logger } from '../logger';

describe('validateStripIdentityPlugin', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should accept a config with the global plugin', () => {
      expect(
        validateStripIdentityPlugin(
          {
            services: [],
            plugins: [
              { name: 'tsdevstack-strip-identity', config: {} },
              { name: 'cors', config: {} },
            ],
          },
          'kong.custom.yml',
        ),
      ).toBe(true);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('should warn when the plugin is missing', () => {
      expect(
        validateStripIdentityPlugin(
          { services: [], plugins: [{ name: 'cors', config: {} }] },
          'kong.custom.yml',
        ),
      ).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'kong.custom.yml has no global tsdevstack-strip-identity plugin',
        ),
      );
    });
  });

  describe('Edge cases', () => {
    it('should warn when there are no global plugins', () => {
      expect(validateStripIdentityPlugin({ services: [] }, 'f')).toBe(false);
    });

    it('should not count the plugin on a service only', () => {
      expect(
        validateStripIdentityPlugin(
          {
            services: [
              {
                name: 's',
                url: 'http://x',
                routes: [],
                plugins: [{ name: 'tsdevstack-strip-identity', config: {} }],
              },
            ],
          },
          'f',
        ),
      ).toBe(false);
    });
  });
});
