import { describe, it, expect } from '@rstest/core';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateStripIdentityPlugin } from './generate-strip-identity-plugin';
import { KONG_CLIENT_IDENTITY_HEADERS } from '../../constants';

const PLUGIN_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'templates',
  'kong-plugins',
  'tsdevstack-strip-identity',
);

describe('generateStripIdentityPlugin', () => {
  describe('Standard use cases', () => {
    it('should return the plugin entry without settings', () => {
      expect(generateStripIdentityPlugin()).toEqual({
        name: 'tsdevstack-strip-identity',
        config: {},
      });
    });
  });

  describe('Lua plugin source', () => {
    const handler = fs.readFileSync(
      path.join(PLUGIN_DIR, 'handler.lua'),
      'utf-8',
    );
    const schema = fs.readFileSync(
      path.join(PLUGIN_DIR, 'schema.lua'),
      'utf-8',
    );

    it('should clear exactly KONG_CLIENT_IDENTITY_HEADERS', () => {
      const block = /local HEADERS = \{([\s\S]*?)\n\}/.exec(handler);
      expect(block).not.toBeNull();
      const luaHeaders = [...block![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

      expect(luaHeaders).toEqual([...KONG_CLIENT_IDENTITY_HEADERS]);
    });

    it('should run in the access phase at priority 50000', () => {
      expect(handler).toMatch(/PRIORITY = 50000,/);
      expect(handler).toMatch(/:access\(conf\)/);
    });

    it('should declare the plugin name in its schema', () => {
      expect(schema).toContain('name = "tsdevstack-strip-identity"');
    });
  });

  describe('Edge cases', () => {
    it('should list the identity headers the backend and Kong auth plugins use', () => {
      for (const header of [
        'X-Userinfo',
        'X-Consumer-ID',
        'X-Consumer-Username',
        'X-Consumer-Custom-ID',
        'X-Credential-Identifier',
        'X-Anonymous-Consumer',
        'X-Api-Key-Id',
        'X-Api-Key-Consumer',
        'X-Kong-Trust',
      ]) {
        expect(KONG_CLIENT_IDENTITY_HEADERS).toContain(header);
      }
    });
  });
});
