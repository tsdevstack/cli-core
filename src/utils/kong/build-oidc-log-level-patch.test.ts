import { describe, it, expect } from '@rstest/core';
import { buildOidcLogLevelPatch } from './build-oidc-log-level-patch';

describe('buildOidcLogLevelPatch', () => {
  describe('Standard use cases', () => {
    it("should lower kong-oidc-v3's rejected-token line to info", () => {
      expect(buildOidcLogLevelPatch()).toContain(
        `sed -i "s/kong.log.err('Bearer JWT verify failed: '/kong.log.info('Bearer JWT verify failed: '/" /usr/local/share/lua/5.1/kong/plugins/oidc/handler.lua`,
      );
    });

    it("should lower lua-resty-openidc's expired-token line to info", () => {
      expect(buildOidcLogLevelPatch()).toContain(
        `sed -i 's/log(ERROR, "token expired: json.exp="/log(ngx.INFO, "token expired: json.exp="/' /usr/local/share/lua/5.1/resty/openidc.lua`,
      );
    });

    it('should lower only the unknown and missing key id errors of the key lookup', () => {
      expect(buildOidcLogLevelPatch()).toContain(
        `sed -i '/secret, err = openidc_pem_from_jwk(opts, jwt_obj.header.kid)/,/return nil, err/ s/log(ERROR, err)/log((err:find("^RSA key with id ") or err:find("^JWT doesn")) and ngx.INFO or ERROR, err)/'`,
      );
    });
  });

  describe('Edge cases', () => {
    it('should stop the build when an edit finds nothing', () => {
      const result = buildOidcLogLevelPatch();
      // One fixed-string check after each of the three edits, all chained
      expect(result.match(/sed -i /g)).toHaveLength(3);
      expect(result.match(/grep -qF /g)).toHaveLength(3);
      expect(result).not.toContain(';');
    });

    it('should leave the discovery document failure at error', () => {
      expect(buildOidcLogLevelPatch()).not.toContain(
        'Discovery document retrieval',
      );
    });
  });
});
