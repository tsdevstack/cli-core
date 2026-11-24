import { describe, it, expect, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  KONG_BASE_IMAGE,
  KONG_PLUGINS_VERSION,
  KONG_FRAMEWORK_PLUGINS_TEMPLATE_DIR,
} from '../../constants';
import { listKongPluginDirs } from './list-kong-plugin-dirs';
import { writeKongPluginsPackage } from './write-kong-plugins-package';
import { resolveCliAssetDir } from '../paths/resolve-cli-asset-dir';

const SHIPPED = resolveCliAssetDir(KONG_FRAMEWORK_PLUGINS_TEMPLATE_DIR);

describe('writeKongPluginsPackage', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function outDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kong-package-'));
    dirs.push(dir);
    return dir;
  }

  describe('Standard use cases', () => {
    it('should write the shipped plugins, a rockspec each and the Dockerfile', () => {
      const out = outDir();

      const result = writeKongPluginsPackage({
        outDir: out,
        pluginsDir: SHIPPED,
      });

      expect(result.version).toBe(KONG_PLUGINS_VERSION);
      expect(result.plugins).toEqual([
        'tsdevstack-api-key',
        'tsdevstack-api-prefix',
        'tsdevstack-client-ip',
        'tsdevstack-opentelemetry',
        'tsdevstack-strip-identity',
        'tsdevstack-trust',
      ]);
      for (const plugin of result.plugins) {
        expect(
          fs.readFileSync(
            path.join(out, 'kong', 'plugins', plugin, 'handler.lua'),
            'utf8',
          ),
        ).toBe(
          fs.readFileSync(path.join(SHIPPED, plugin, 'handler.lua'), 'utf8'),
        );
        expect(
          fs.existsSync(
            path.join(
              out,
              'rockspecs',
              `${plugin}-${KONG_PLUGINS_VERSION}-1.rockspec`,
            ),
          ),
        ).toBe(true);
      }
      const apiKeySpec = fs.readFileSync(
        path.join(
          out,
          'rockspecs',
          `tsdevstack-api-key-${KONG_PLUGINS_VERSION}-1.rockspec`,
        ),
        'utf8',
      );
      for (const module of [
        'handler',
        'redis',
        'schema',
        'script',
        'windows',
      ]) {
        expect(apiKeySpec).toContain(
          `["kong.plugins.tsdevstack-api-key.${module}"]`,
        );
      }
      expect(fs.readFileSync(path.join(out, 'Dockerfile'), 'utf8')).toContain(
        'ENV KONG_PLUGINS=bundled,oidc,tsdevstack-api-key,tsdevstack-api-prefix,tsdevstack-client-ip,tsdevstack-opentelemetry,tsdevstack-strip-identity,tsdevstack-trust',
      );
    });
  });

  describe('Edge cases', () => {
    it('should leave hidden files and folders out', () => {
      const plugins = outDir();
      fs.mkdirSync(path.join(plugins, 'tsdevstack-x', '.cache'), {
        recursive: true,
      });
      fs.writeFileSync(path.join(plugins, 'tsdevstack-x', 'handler.lua'), '');
      fs.writeFileSync(path.join(plugins, 'tsdevstack-x', 'schema.lua'), '');
      fs.writeFileSync(path.join(plugins, 'tsdevstack-x', '.DS_Store'), 'x');
      fs.writeFileSync(
        path.join(plugins, 'tsdevstack-x', '.cache', 'hidden.lua'),
        '',
      );
      const out = outDir();

      writeKongPluginsPackage({ outDir: out, pluginsDir: plugins });

      expect(
        fs.readdirSync(path.join(out, 'kong', 'plugins', 'tsdevstack-x')),
      ).toEqual(['handler.lua', 'schema.lua']);
      const spec = fs.readFileSync(
        path.join(
          out,
          'rockspecs',
          `tsdevstack-x-${KONG_PLUGINS_VERSION}-1.rockspec`,
        ),
        'utf8',
      );
      expect(spec).not.toContain('hidden');
    });

    it('should ship plugins whose handlers report the published version', () => {
      // Kong lists each plugin's VERSION (Admin API /plugins/enabled and
      // the node's plugin list): keep them at KONG_PLUGINS_VERSION
      for (const plugin of listKongPluginDirs(SHIPPED)) {
        const handler = fs.readFileSync(
          path.join(SHIPPED, plugin, 'handler.lua'),
          'utf8',
        );
        expect({
          plugin,
          version: /VERSION = "([^"]+)"/.exec(handler)?.[1],
        }).toEqual({
          plugin,
          version: KONG_PLUGINS_VERSION,
        });
      }
    });

    it("should match the plugins package's version", () => {
      // The package (packages/kong-plugins) holds the plugins at kong/plugins
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(SHIPPED, '..', '..', 'package.json'), 'utf8'),
      ) as { name?: string; version?: string };

      expect(packageJson).toMatchObject({
        name: '@tsdevstack/kong-plugins',
        version: KONG_PLUGINS_VERSION,
      });
    });

    it("should have the plugins package's tests run on the Kong the CLI builds from", () => {
      const constants = fs.readFileSync(
        path.join(SHIPPED, '..', '..', 'tests', 'helpers', 'constants.ts'),
        'utf8',
      );

      expect(constants).toContain(`KONG_IMAGE = '${KONG_BASE_IMAGE}';`);
    });

    it("should replace an earlier run's plugins and specs, and keep other files", () => {
      const out = outDir();
      fs.mkdirSync(path.join(out, 'kong', 'plugins', 'gone'), {
        recursive: true,
      });
      fs.mkdirSync(path.join(out, 'rockspecs'), { recursive: true });
      fs.writeFileSync(
        path.join(out, 'rockspecs', 'gone-0.1.0-1.rockspec'),
        '',
      );
      fs.writeFileSync(path.join(out, 'README.md'), '# kept');

      writeKongPluginsPackage({ outDir: out, pluginsDir: SHIPPED });

      expect(fs.existsSync(path.join(out, 'kong', 'plugins', 'gone'))).toBe(
        false,
      );
      expect(
        fs.existsSync(path.join(out, 'rockspecs', 'gone-0.1.0-1.rockspec')),
      ).toBe(false);
      expect(fs.readFileSync(path.join(out, 'README.md'), 'utf8')).toBe(
        '# kept',
      );
    });
  });
});
