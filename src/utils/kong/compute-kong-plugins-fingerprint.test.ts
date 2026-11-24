import { describe, it, expect, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  KONG_PLUGINS_FINGERPRINT,
  KONG_PLUGINS_VERSION,
  KONG_FRAMEWORK_PLUGINS_TEMPLATE_DIR,
} from '../../constants';
import { computeKongPluginsFingerprint } from './compute-kong-plugins-fingerprint';
import { resolveCliAssetDir } from '../paths/resolve-cli-asset-dir';

const SHIPPED = resolveCliAssetDir(KONG_FRAMEWORK_PLUGINS_TEMPLATE_DIR);

describe('computeKongPluginsFingerprint', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function pluginsDir(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kong-fp-'));
    dirs.push(dir);
    for (const [file, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), content);
    }
    return dir;
  }

  describe('Standard use cases', () => {
    it(`should match the shipped plugins at version ${KONG_PLUGINS_VERSION}`, () => {
      const actual = computeKongPluginsFingerprint(SHIPPED);

      // A plugin or the image's base layers changed: bump
      // KONG_PLUGINS_VERSION (semver) and set KONG_PLUGINS_FINGERPRINT to
      // the value below, both in src/constants/kong.ts
      expect({
        message:
          'bump KONG_PLUGINS_VERSION and update KONG_PLUGINS_FINGERPRINT',
        fingerprint: actual,
      }).toEqual({
        message:
          'bump KONG_PLUGINS_VERSION and update KONG_PLUGINS_FINGERPRINT',
        fingerprint: KONG_PLUGINS_FINGERPRINT,
      });
    });

    it('should change when a file changes', () => {
      const before = computeKongPluginsFingerprint(
        pluginsDir({ 'a/handler.lua': 'return 1' }),
      );
      const after = computeKongPluginsFingerprint(
        pluginsDir({ 'a/handler.lua': 'return 2' }),
      );

      expect(after).not.toBe(before);
    });
  });

  describe('Edge cases', () => {
    it('should change when a file is renamed or added', () => {
      const base = computeKongPluginsFingerprint(
        pluginsDir({ 'a/handler.lua': 'x' }),
      );

      expect(
        computeKongPluginsFingerprint(pluginsDir({ 'a/schema.lua': 'x' })),
      ).not.toBe(base);
      expect(
        computeKongPluginsFingerprint(
          pluginsDir({ 'a/handler.lua': 'x', 'a/extra.lua': '' }),
        ),
      ).not.toBe(base);
    });

    it('should skip hidden files and folders', () => {
      expect(
        computeKongPluginsFingerprint(
          pluginsDir({
            'a/handler.lua': 'x',
            'a/.DS_Store': 'mac',
            '.editor/settings': '{}',
          }),
        ),
      ).toBe(
        computeKongPluginsFingerprint(pluginsDir({ 'a/handler.lua': 'x' })),
      );
    });

    it('should not depend on the order files were written in', () => {
      expect(
        computeKongPluginsFingerprint(
          pluginsDir({ 'b/x.lua': '1', 'a/y.lua': '2' }),
        ),
      ).toBe(
        computeKongPluginsFingerprint(
          pluginsDir({ 'a/y.lua': '2', 'b/x.lua': '1' }),
        ),
      );
    });
  });
});
