import { describe, it, expect } from '@rstest/core';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { generateTrustPlugin } from './generate-trust-plugin';
import { KONG_TRUST_HEADER } from '../../constants';

const PLUGIN_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'templates',
  'kong-plugins',
  'tsdevstack-trust',
);

describe('generateTrustPlugin', () => {
  describe('Standard use cases', () => {
    it('should set the trust header from the trust token placeholder', () => {
      expect(generateTrustPlugin()).toEqual({
        name: 'tsdevstack-trust',
        config: {
          token: '${KONG_TRUST_TOKEN}',
          header: 'X-Kong-Trust',
        },
      });
    });
  });

  describe('Plugin source', () => {
    const schema = fs.readFileSync(path.join(PLUGIN_DIR, 'schema.lua'), 'utf8');

    it('should default the header to KONG_TRUST_HEADER', () => {
      expect(schema).toContain(`default = "${KONG_TRUST_HEADER}"`);
    });

    it('should let the token be an env vault reference', () => {
      expect(schema).toMatch(
        /token = \{ type = "string", required = true, referenceable = true \}/,
      );
    });

    it('should run after request-transformer (priority 801)', () => {
      const handler = fs.readFileSync(
        path.join(PLUGIN_DIR, 'handler.lua'),
        'utf8',
      );
      const priority = Number(/PRIORITY = (\d+)/.exec(handler)?.[1]);
      expect(priority).toBeLessThan(801);
    });
  });
});
