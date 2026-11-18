import { describe, it, expect } from '@rstest/core';
import { buildKongPluginRockspec } from './build-kong-plugin-rockspec';

describe('buildKongPluginRockspec', () => {
  describe('Standard use cases', () => {
    it("should map each Lua file to a module under the plugin's Kong path", () => {
      const spec = buildKongPluginRockspec({
        plugin: 'tsdevstack-api-key',
        files: ['schema.lua', 'handler.lua', 'redis.lua'],
        version: '1.2.0',
      });

      expect(spec).toContain('package = "tsdevstack-api-key"');
      expect(spec).toContain('version = "1.2.0-1"');
      expect(spec).toContain(
        'url = "git+https://github.com/tsdevstack/kong-plugins.git",',
      );
      expect(spec).toContain('tag = "v1.2.0",');
      expect(spec).toContain('license = "Apache-2.0",');
      expect(spec).toContain(
        'summary = "API keys checked against Redis, with per-key limits per time window",',
      );
      expect(spec).toContain('Tested with Kong 3.9.4 (open source).');
      expect(spec).toContain(
        `    ["kong.plugins.tsdevstack-api-key.handler"] = "kong/plugins/tsdevstack-api-key/handler.lua",
    ["kong.plugins.tsdevstack-api-key.redis"] = "kong/plugins/tsdevstack-api-key/redis.lua",
    ["kong.plugins.tsdevstack-api-key.schema"] = "kong/plugins/tsdevstack-api-key/schema.lua",`,
      );
    });
  });

  describe('Edge cases', () => {
    it('should skip files that are not Lua and map subfolders to dotted modules', () => {
      const spec = buildKongPluginRockspec({
        plugin: 'tsdevstack-trust',
        files: ['handler.lua', 'README.md', 'lib/util.lua'],
        version: '1.0.0',
      });

      expect(spec).not.toContain('README');
      expect(spec).toContain(
        '["kong.plugins.tsdevstack-trust.lib.util"] = "kong/plugins/tsdevstack-trust/lib/util.lua",',
      );
    });

    it('should describe a plugin without a summary by its name', () => {
      expect(
        buildKongPluginRockspec({
          plugin: 'tsdevstack-new',
          files: ['handler.lua'],
          version: '1.0.0',
        }),
      ).toContain('summary = "The tsdevstack-new Kong plugin",');
    });
  });
});
