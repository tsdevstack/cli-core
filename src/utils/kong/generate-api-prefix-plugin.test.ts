import { describe, it, expect } from '@rstest/core';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateApiPrefixPlugin } from './generate-api-prefix-plugin';

const PLUGIN_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'templates',
  'kong-plugins',
  'tsdevstack-api-prefix',
);

describe('generateApiPrefixPlugin', () => {
  describe('Standard use cases', () => {
    it('should remove /api', () => {
      expect(generateApiPrefixPlugin()).toEqual({
        name: 'tsdevstack-api-prefix',
        config: { prefix: '/api' },
      });
    });
  });

  describe('Lua plugin source', () => {
    it('should rewrite the upstream path from the normalized request path in the access phase', () => {
      const handler = fs.readFileSync(
        path.join(PLUGIN_DIR, 'handler.lua'),
        'utf-8',
      );

      expect(handler).toMatch(/PRIORITY = 940,/);
      expect(handler).toMatch(/:access\(conf\)/);
      expect(handler).toContain('kong.request.get_path()');
      expect(handler).toContain('kong.service.request.set_path(');
    });

    it('should declare the plugin name and prefix field in its schema', () => {
      const schema = fs.readFileSync(
        path.join(PLUGIN_DIR, 'schema.lua'),
        'utf-8',
      );

      expect(schema).toContain('name = "tsdevstack-api-prefix"');
      expect(schema).toContain('prefix = {');
    });
  });

  describe('Edge cases', () => {
    it('should return a new object on every call', () => {
      expect(generateApiPrefixPlugin()).not.toBe(generateApiPrefixPlugin());
    });
  });
});
