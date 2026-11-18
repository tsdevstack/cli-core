import { describe, it, expect } from '@rstest/core';
import { buildKongBaseLayers } from './build-kong-base-layers';

describe('buildKongBaseLayers', () => {
  describe('Standard use cases', () => {
    it('should start from the pinned Kong image and install the OIDC plugin', () => {
      const layers = buildKongBaseLayers();

      expect(layers.startsWith('FROM kong:3.9.4\n')).toBe(true);
      expect(layers).toContain('--branch v1.7.6');
      expect(layers).toContain(
        'git fetch -q --depth 1 https://github.com/Gate1106/kong-oidc-v3.git 5c5397ac1ea2848401d73758244ba626afb04a17',
      );
    });

    it("should keep the OIDC code's license texts in the image", () => {
      const layers = buildKongBaseLayers();

      expect(layers).toContain(
        'cp LICENSE.txt /usr/local/share/licenses/lua-resty-openidc/',
      );
      expect(layers).toContain(
        'cp LICENSE /usr/local/share/licenses/kong-oidc-v3/',
      );
      // Copied before the clones are removed
      expect(
        layers.indexOf('cp LICENSE.txt /usr/local/share/licenses'),
      ).toBeLessThan(layers.indexOf('rm -rf /tmp/lua-resty-openidc'));
      expect(
        layers.indexOf('cp LICENSE /usr/local/share/licenses/kong-oidc-v3/'),
      ).toBeLessThan(layers.indexOf('rm -rf /tmp/kong-oidc-v3'));
    });
  });

  describe('Edge cases', () => {
    it("should end with the change to the OIDC plugin's bad-token logs", () => {
      const layers = buildKongBaseLayers();

      expect(
        layers.indexOf("kong.log.info('Bearer JWT verify failed: '"),
      ).toBeGreaterThan(layers.indexOf('rm -rf /tmp/kong-oidc-v3'));
      expect(layers).not.toContain('KONG_PLUGINS');
    });
  });
});
