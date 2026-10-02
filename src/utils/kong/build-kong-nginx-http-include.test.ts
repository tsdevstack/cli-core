import { describe, it, expect } from '@rstest/core';
import { buildKongNginxHttpInclude } from './build-kong-nginx-http-include';

describe('buildKongNginxHttpInclude', () => {
  describe('Standard use cases', () => {
    it('should write the discovery and jwks shared dicts into the include file', () => {
      expect(buildKongNginxHttpInclude()).toContain(
        "RUN printf '%s\\n' 'lua_shared_dict discovery 1m;' 'lua_shared_dict jwks 1m;' > /etc/kong/tsdevstack-nginx-http.conf",
      );
    });

    it('should include the file in the http block through KONG_NGINX_HTTP_INCLUDE', () => {
      expect(buildKongNginxHttpInclude()).toMatch(
        /^ENV KONG_NGINX_HTTP_INCLUDE=\/etc\/kong\/tsdevstack-nginx-http\.conf$/m,
      );
    });

    it('should leave KONG_NGINX_HTTP_LUA_SHARED_DICT to the user', () => {
      expect(buildKongNginxHttpInclude()).not.toContain(
        'KONG_NGINX_HTTP_LUA_SHARED_DICT',
      );
    });
  });

  describe('Edge cases', () => {
    it('should write the file before pointing Kong at it', () => {
      const result = buildKongNginxHttpInclude();
      expect(result.indexOf('RUN printf')).toBeLessThan(
        result.indexOf('ENV KONG_NGINX_HTTP_INCLUDE='),
      );
    });

    it('should not declare the introspection or jwt_verification caches', () => {
      const result = buildKongNginxHttpInclude();
      expect(result).not.toContain('introspection');
      expect(result).not.toContain('jwt_verification');
    });
  });
});
