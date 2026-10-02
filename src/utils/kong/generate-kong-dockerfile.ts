/**
 * Generate the Kong Gateway Dockerfile (local and cloud)
 *
 * One image definition for every environment. The defaults baked into the
 * image are the cloud settings (proxy on 8080, Admin API off, config baked in
 * /kong/declarative/kong.yml). Local development overrides them at runtime
 * through environment variables (see the docker-compose gateway service).
 */

import {
  KONG_BASE_IMAGE,
  KONG_DECLARATIVE_DIR,
  KONG_OIDC_PLUGIN_NAME,
  KONG_OIDC_V3_COMMIT,
  KONG_PLUGINS_BUNDLED_KEYWORD,
  KONG_PLUGINS_DIR,
  LUA_RESTY_OPENIDC_VERSION,
  KONG_GENERATED_FILE_HEADER,
} from '../../constants';
import { buildKongHealthCheckScript } from './build-kong-health-check-script';
import { buildKongNginxHttpInclude } from './build-kong-nginx-http-include';

export interface GenerateKongDockerfileOptions {
  /** Max upload size for traditional file uploads (nginx client_max_body_size). Default: "10m" */
  maxUploadSize?: string;
  /**
   * Full KONG_PLUGINS list (see buildKongPluginList).
   * Default: bundled plugins plus the OIDC plugin.
   */
  kongPlugins?: readonly string[];
}

/**
 * Returns the Dockerfile content for Kong Gateway
 *
 * The build context must contain `kong-plugins/` (one folder per custom
 * plugin, may be empty) and `declarative/` (may be empty).
 */
export function generateKongDockerfile(
  options?: GenerateKongDockerfileOptions,
): string {
  const healthCheckScript = buildKongHealthCheckScript();
  const nginxHttpInclude = buildKongNginxHttpInclude();
  const maxUploadSize = options?.maxUploadSize ?? '10m';
  const kongPlugins = options?.kongPlugins ?? [
    KONG_PLUGINS_BUNDLED_KEYWORD,
    KONG_OIDC_PLUGIN_NAME,
  ];

  return `${KONG_GENERATED_FILE_HEADER}
# Custom Kong plugins go in kong-plugins/ at the project root.

FROM ${KONG_BASE_IMAGE}

# Switch to root to install plugins and configure
USER root

# Install dependencies for plugin installation and health checks
RUN apt-get update && apt-get install -y git unzip curl && rm -rf /var/lib/apt/lists/*

# Install lua-resty-openidc dependency manually (luarocks has manifest size issues)
RUN git clone --depth 1 --branch ${LUA_RESTY_OPENIDC_VERSION} https://github.com/zmartzone/lua-resty-openidc.git /tmp/lua-resty-openidc && \\
    cd /tmp/lua-resty-openidc && \\
    cp -r lib/resty/* /usr/local/share/lua/5.1/resty/ && \\
    rm -rf /tmp/lua-resty-openidc

# Install kong-oidc-v3 plugin manually (shallow fetch of the pinned commit)
RUN mkdir -p /tmp/kong-oidc-v3 && \\
    cd /tmp/kong-oidc-v3 && \\
    git init -q && \\
    git fetch -q --depth 1 https://github.com/Gate1106/kong-oidc-v3.git ${KONG_OIDC_V3_COMMIT} && \\
    git checkout -q FETCH_HEAD && \\
    mkdir -p /usr/local/share/lua/5.1/kong/plugins/oidc && \\
    cp -r /tmp/kong-oidc-v3/kong/plugins/oidc/* /usr/local/share/lua/5.1/kong/plugins/oidc/ && \\
    rm -rf /tmp/kong-oidc-v3

# Framework and project plugins (one folder per plugin)
COPY ${KONG_PLUGINS_DIR}/ /usr/local/share/lua/5.1/kong/plugins/

# Enable the bundled, OIDC, framework and project plugins
ENV KONG_PLUGINS=${kongPlugins.join(',')}

# Database-less mode
ENV KONG_DATABASE=off
ENV KONG_DECLARATIVE_CONFIG=/kong/declarative/kong.yml

# Proxy port (cloud default; local development overrides it)
ENV KONG_PROXY_LISTEN="0.0.0.0:8080"

# Admin API disabled by default (local development enables it)
ENV KONG_ADMIN_LISTEN="off"

# Status API for health checks (internal port)
ENV KONG_STATUS_LISTEN="0.0.0.0:8100"

# Logging
ENV KONG_PROXY_ACCESS_LOG=/dev/stdout
ENV KONG_PROXY_ERROR_LOG=/dev/stderr
ENV KONG_LOG_LEVEL=notice

# Memory configuration (production tuning)
ENV KONG_MEM_CACHE_SIZE=256m
ENV KONG_LMDB_MAP_SIZE=2048m

# Faster cold starts
ENV KONG_DB_CACHE_WARMUP_ENTITIES=services
ENV KONG_NGINX_WORKER_PROCESSES=2

# Max upload size for traditional file uploads (default: 10m)
ENV KONG_NGINX_HTTP_CLIENT_MAX_BODY_SIZE=${maxUploadSize}

${nginxHttpInclude}
# Client IP detection behind Load Balancer
ENV KONG_TRUSTED_IPS="10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"
ENV KONG_REAL_IP_HEADER="X-Forwarded-For"
ENV KONG_REAL_IP_RECURSIVE="on"

# Container port
EXPOSE 8080
EXPOSE 8100

# Graceful shutdown (Kong uses SIGQUIT, not SIGTERM!)
STOPSIGNAL SIGQUIT

# Declarative config directory (cloud builds bake kong.yml in; local mounts it)
RUN mkdir -p /kong/declarative && chown kong:kong /kong/declarative
COPY --chown=kong:kong ${KONG_DECLARATIVE_DIR}/ /kong/declarative/

${healthCheckScript}
# Switch back to kong user for runtime
USER kong
CMD ["kong", "docker-start"]
`;
}
