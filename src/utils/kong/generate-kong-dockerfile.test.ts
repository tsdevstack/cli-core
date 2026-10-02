import { describe, it, expect } from '@rstest/core';
import { generateKongDockerfile } from './generate-kong-dockerfile';

describe('generateKongDockerfile', () => {
  it('should return a string', () => {
    const result = generateKongDockerfile();
    expect(typeof result).toBe('string');
  });

  it('should pin the kong:3.8.0 base image', () => {
    const result = generateKongDockerfile();
    expect(result).toMatch(/^FROM kong:3\.8\.0$/m);
  });

  it('should pin kong-oidc-v3 to a commit and lua-resty-openidc to v1.7.6', () => {
    const result = generateKongDockerfile();
    expect(result).toContain(
      'git fetch -q --depth 1 https://github.com/Gate1106/kong-oidc-v3.git 5c5397ac1ea2848401d73758244ba626afb04a17',
    );
    expect(result).toContain('git checkout -q FETCH_HEAD');
    expect(result).not.toContain('git clone https://github.com/Gate1106');
    expect(result).toContain('--branch v1.7.6');
  });

  it('should include OIDC plugin installation', () => {
    const result = generateKongDockerfile();
    expect(result).toContain('kong-oidc');
    expect(result).toContain('lua-resty-openidc');
  });

  it('should enable bundled and OIDC plugins by default', () => {
    const result = generateKongDockerfile();
    expect(result).toMatch(/^ENV KONG_PLUGINS=bundled,oidc$/m);
  });

  it('should list the given plugins in KONG_PLUGINS', () => {
    const result = generateKongDockerfile({
      kongPlugins: ['bundled', 'oidc', 'tsdevstack-x', 'my-plugin'],
    });
    expect(result).toMatch(
      /^ENV KONG_PLUGINS=bundled,oidc,tsdevstack-x,my-plugin$/m,
    );
  });

  it('should copy the staged plugins folder into the Kong plugins path', () => {
    const result = generateKongDockerfile();
    expect(result).toContain(
      'COPY kong-plugins/ /usr/local/share/lua/5.1/kong/plugins/',
    );
    // Plugins are installed before KONG_PLUGINS is set
    expect(result.indexOf('COPY kong-plugins/')).toBeLessThan(
      result.indexOf('ENV KONG_PLUGINS='),
    );
  });

  it('should configure database-less mode', () => {
    const result = generateKongDockerfile();
    expect(result).toContain('KONG_DATABASE=off');
    expect(result).toContain('KONG_DECLARATIVE_CONFIG');
  });

  it('should configure proxy on port 8080', () => {
    const result = generateKongDockerfile();
    expect(result).toContain('KONG_PROXY_LISTEN="0.0.0.0:8080"');
    expect(result).toContain('EXPOSE 8080');
  });

  it('should disable admin API for security', () => {
    const result = generateKongDockerfile();
    expect(result).toContain('KONG_ADMIN_LISTEN="off"');
  });

  it('should configure status endpoint for health checks', () => {
    const result = generateKongDockerfile();
    expect(result).toContain('KONG_STATUS_LISTEN');
    expect(result).toContain('8100');
  });

  it('should configure logging to stdout/stderr', () => {
    const result = generateKongDockerfile();
    expect(result).toContain('KONG_PROXY_ACCESS_LOG=/dev/stdout');
    expect(result).toContain('KONG_PROXY_ERROR_LOG=/dev/stderr');
  });

  it('should use SIGQUIT for graceful shutdown', () => {
    const result = generateKongDockerfile();
    expect(result).toContain('STOPSIGNAL SIGQUIT');
  });

  it('should configure trusted IPs for load balancer', () => {
    const result = generateKongDockerfile();
    expect(result).toContain('KONG_TRUSTED_IPS');
    expect(result).toContain('KONG_REAL_IP_HEADER');
  });

  it('should copy the fixed declarative/ directory, not a single kong.yml', () => {
    const result = generateKongDockerfile();
    expect(result).toContain(
      'COPY --chown=kong:kong declarative/ /kong/declarative/',
    );
    expect(result).not.toContain('COPY kong.yml');
  });

  it('should produce one image definition for local and every cloud provider', () => {
    // Local and cloud differ only in runtime environment variables and the
    // content of declarative/; nothing in the Dockerfile depends on the provider.
    const kongPlugins = ['bundled', 'oidc', 'my-plugin'];
    const result = generateKongDockerfile({ kongPlugins });
    expect(result).toContain('ENV KONG_PLUGINS=bundled,oidc,my-plugin');
    expect(result).not.toMatch(/aws|gcp|azure/i);
  });

  describe('Runtime defaults (cloud), overridable by environment (local)', () => {
    it('should default to the cloud settings', () => {
      const result = generateKongDockerfile();
      expect(result).toContain('ENV KONG_PROXY_LISTEN="0.0.0.0:8080"');
      expect(result).toContain('ENV KONG_ADMIN_LISTEN="off"');
      expect(result).toContain(
        'ENV KONG_DECLARATIVE_CONFIG=/kong/declarative/kong.yml',
      );
    });

    it('should set them with ENV only (no hardcoded listen flags in CMD)', () => {
      const result = generateKongDockerfile();
      expect(result).toContain('CMD ["kong", "docker-start"]');
      expect(result).not.toMatch(/CMD .*listen/);
    });
  });

  it('should switch to kong user for runtime', () => {
    const result = generateKongDockerfile();
    expect(result).toContain('USER kong');
    expect(result).toContain('CMD ["kong", "docker-start"]');
  });

  it('should include basic health check for all providers', () => {
    const result = generateKongDockerfile();
    expect(result).toContain('kong-health-check.sh');
    expect(result).toContain('localhost:8100/status/ready');
  });

  it('should not wait for OIDC discovery or wake any service in the health check', () => {
    const result = generateKongDockerfile();
    expect(result).not.toContain('openid-configuration');
    expect(result).not.toContain('WAKEUP_LAMBDA_URL');
    expect(result).not.toContain('WAKEUP_SECRET');
  });

  it('should declare the lua-resty-openidc caches through an http include file', () => {
    const result = generateKongDockerfile();
    expect(result).toContain(
      "'lua_shared_dict discovery 1m;' 'lua_shared_dict jwks 1m;' > /etc/kong/tsdevstack-nginx-http.conf",
    );
    expect(result).toMatch(
      /^ENV KONG_NGINX_HTTP_INCLUDE=\/etc\/kong\/tsdevstack-nginx-http\.conf$/m,
    );
    // Written as root, before the image switches to the kong user
    expect(result.indexOf('/etc/kong/tsdevstack-nginx-http.conf')).toBeLessThan(
      result.lastIndexOf('USER kong'),
    );
  });

  it('should set default max upload size to 10m', () => {
    const result = generateKongDockerfile();
    expect(result).toContain('KONG_NGINX_HTTP_CLIENT_MAX_BODY_SIZE=10m');
  });

  it('should use custom max upload size when provided', () => {
    const result = generateKongDockerfile({ maxUploadSize: '50m' });
    expect(result).toContain('KONG_NGINX_HTTP_CLIENT_MAX_BODY_SIZE=50m');
  });

  it('should allow unlimited upload size with 0', () => {
    const result = generateKongDockerfile({ maxUploadSize: '0' });
    expect(result).toContain('KONG_NGINX_HTTP_CLIENT_MAX_BODY_SIZE=0');
  });
});
