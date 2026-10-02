/**
 * Source checks of the tsdevstack-api-key Kong plugin (Lua), against the
 * Redis contract in @tsdevstack/nest-common. Behavior is covered by
 * api-key-script.docker.test.ts and api-key-plugin.docker.test.ts.
 */

import { describe, it, expect } from '@rstest/core';
import * as fs from 'fs';
import * as path from 'path';
import {
  getApiKeyPluginDir,
  loadApiKeyContract,
  readApiKeyScriptSource,
} from '../../test-utils/kong';

const {
  API_KEY_INDEX_MARKER_KEY,
  API_KEY_LAST_USED_TTL_SECONDS,
  API_KEY_LAST_USED_WRITE_INTERVAL_SECONDS,
  API_KEY_RECORD_VERSIONS,
  API_KEY_WINDOW_KEY_SEGMENTS,
  API_KEY_WINDOWS,
} = loadApiKeyContract();

function read(file: string): string {
  return fs.readFileSync(path.join(getApiKeyPluginDir(), file), 'utf-8');
}

describe('tsdevstack-api-key plugin source', () => {
  describe('Standard use cases', () => {
    const handler = read('handler.lua');
    const schema = read('schema.lua');
    const windows = read('windows.lua');
    const script = readApiKeyScriptSource();

    it('should run in the access phase at priority 900', () => {
      expect(handler).toMatch(/PRIORITY = 900,/);
      expect(handler).toMatch(/:access\(conf\)/);
      expect(handler).not.toContain('kong.client.authenticate(');
    });

    it('should declare its name and x-api-key as the default key header', () => {
      expect(schema).toContain('name = "tsdevstack-api-key"');
      expect(schema).toContain('default = { "x-api-key" }');
      expect(schema).toContain('require "kong.tools.redis.schema"');
    });

    it('should use the contract windows, segments and marker key', () => {
      const names = API_KEY_WINDOWS.map((w) => `"${w}"`).join(', ');
      const segments = API_KEY_WINDOWS.map(
        (w) => `"${API_KEY_WINDOW_KEY_SEGMENTS[w]}"`,
      ).join(', ');

      expect(windows).toContain(`_M.NAMES = { ${names} }`);
      expect(windows).toContain(`_M.SEGMENTS = { ${segments} }`);
      expect(script).toContain(`local WINDOWS = { ${names} }`);
      expect(handler).toContain(
        `local INDEX_MARKER_KEY = "${API_KEY_INDEX_MARKER_KEY}"`,
      );
    });

    it('should know exactly the contract record versions', () => {
      const known = API_KEY_RECORD_VERSIONS.map((v) => `[${v}] = true`).join(
        ', ',
      );
      expect(script).toContain(`local KNOWN_VERSIONS = { ${known} }`);
    });

    it('should use the contract last-used interval and TTL', () => {
      expect(script).toContain(
        `local LAST_USED_WRITE_INTERVAL = ${API_KEY_LAST_USED_WRITE_INTERVAL_SECONDS}`,
      );
      expect(script).toContain(
        `local LAST_USED_TTL = ${API_KEY_LAST_USED_TTL_SECONDS}`,
      );
    });

    it('should answer with every design error code', () => {
      for (const code of [
        'api_key_missing',
        'invalid_api_key',
        'api_key_revoked',
        'api_key_expired',
        'rate_limit_exceeded',
        'quota_exceeded',
        'index_unavailable',
        'gateway_unavailable',
      ]) {
        expect(handler).toContain(`${code} = {`);
      }
    });
  });

  describe('Edge cases', () => {
    it('should never set CORS headers itself', () => {
      for (const file of ['handler.lua', 'redis.lua', 'script.lua']) {
        expect(read(file).toLowerCase()).not.toContain('access-control-');
      }
    });

    it('should never read the marker inside the script (other hash slot)', () => {
      expect(readApiKeyScriptSource()).not.toContain('apikey:meta');
    });
  });
});
