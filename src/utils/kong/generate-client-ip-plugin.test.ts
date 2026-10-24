import { describe, it, expect } from '@rstest/core';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateClientIpPlugin } from './generate-client-ip-plugin';
import {
  KONG_CLIENT_IP_HEADER,
  KONG_FRONTEND_TOKEN_HEADER,
  KONG_UPSTREAM_CLIENT_IP_HEADER,
} from '../../constants';

const PLUGIN_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'templates',
  'kong-plugins',
  'tsdevstack-client-ip',
);

describe('generateClientIpPlugin', () => {
  describe('Standard use cases', () => {
    it('should reference the frontend token secret and name both headers', () => {
      expect(generateClientIpPlugin()).toEqual({
        name: 'tsdevstack-client-ip',
        config: {
          frontend_token: '${KONG_FRONTEND_TOKEN}',
          client_ip_header: 'X-Tsdevstack-Client-IP',
          token_header: 'X-Tsdevstack-Frontend-Token',
          real_ip_header: 'X-Tsdevstack-Real-IP',
        },
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

    it('should default to the same header names as the CLI', () => {
      expect(schema).toContain(
        `client_ip_header = { type = "string", required = true, default = "${KONG_CLIENT_IP_HEADER}" }`,
      );
      expect(schema).toContain(
        `token_header = { type = "string", required = true, default = "${KONG_FRONTEND_TOKEN_HEADER}" }`,
      );
      expect(schema).toContain(
        `real_ip_header = { type = "string", required = true, default = "${KONG_UPSTREAM_CLIENT_IP_HEADER}" }`,
      );
    });

    it('should run in the access phase between the auth plugins and rate-limiting', () => {
      // oidc 1000 sets the user credential first; rate-limiting 910 reads it
      expect(handler).toMatch(/PRIORITY = 950,/);
      expect(handler).toMatch(/:access\(conf\)/);
    });

    it('should declare the plugin name in its schema', () => {
      expect(schema).toContain('name = "tsdevstack-client-ip"');
    });
  });
});
