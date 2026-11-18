import { describe, it, expect } from '@rstest/core';
import { generateKongPluginsImageDockerfile } from './generate-kong-plugins-image-dockerfile';
import { generateKongDockerfile } from './generate-kong-dockerfile';
import { buildKongBaseLayers } from './build-kong-base-layers';

const PLUGINS = ['tsdevstack-trust', 'tsdevstack-api-key'];

describe('generateKongPluginsImageDockerfile', () => {
  describe('Standard use cases', () => {
    it("should start with the same base layers as a project's Kong image", () => {
      const image = generateKongPluginsImageDockerfile({
        plugins: PLUGINS,
        version: '1.0.0',
      });

      expect(image).toContain(buildKongBaseLayers());
      expect(generateKongDockerfile()).toContain(buildKongBaseLayers());
    });

    it('should copy the plugins from the repo and switch them all on', () => {
      const image = generateKongPluginsImageDockerfile({
        plugins: PLUGINS,
        version: '1.0.0',
      });

      expect(image).toContain(
        'COPY kong/plugins/ /usr/local/share/lua/5.1/kong/plugins/',
      );
      expect(image).toMatch(
        /^ENV KONG_PLUGINS=bundled,oidc,tsdevstack-api-key,tsdevstack-trust$/m,
      );
      expect(image).toContain(
        'COPY LICENSE /usr/local/share/licenses/tsdevstack-kong-plugins/LICENSE',
      );
    });

    it('should label the image with its repo, version and license', () => {
      const image = generateKongPluginsImageDockerfile({
        plugins: PLUGINS,
        version: '1.4.2',
      });

      expect(image).toContain(
        'LABEL org.opencontainers.image.source="https://github.com/tsdevstack/kong-plugins"',
      );
      expect(image).toContain('LABEL org.opencontainers.image.version="1.4.2"');
      expect(image).toContain(
        'LABEL org.opencontainers.image.licenses="Apache-2.0"',
      );
    });
  });

  describe('Edge cases', () => {
    it("should leave Kong's own settings alone and run as kong", () => {
      const image = generateKongPluginsImageDockerfile({
        plugins: PLUGINS,
        version: '1.0.0',
      });

      expect(image).not.toContain('KONG_DATABASE');
      expect(image).not.toContain('KONG_PROXY_LISTEN');
      expect(image).not.toContain('declarative');
      expect(image.trimEnd().endsWith('USER kong')).toBe(true);
    });
  });
});
