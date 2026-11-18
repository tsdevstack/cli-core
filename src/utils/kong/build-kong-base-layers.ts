/**
 * Build the first part of every Kong image the framework makes: the
 * projects' images (generateKongDockerfile) and the public plugins image
 * (generateKongPluginsImageDockerfile). Kong, the OIDC plugin with its
 * dependency and their license texts, and the change that logs a client's
 * bad token below error. The plugins and settings come after it.
 */

import {
  KONG_BASE_IMAGE,
  KONG_OIDC_V3_COMMIT,
  LUA_RESTY_OPENIDC_VERSION,
} from '../../constants';
import { buildOidcLogLevelPatch } from './build-oidc-log-level-patch';

export function buildKongBaseLayers(): string {
  return `FROM ${KONG_BASE_IMAGE}

# Switch to root to install plugins and configure
USER root

# Install dependencies for plugin installation and health checks
RUN apt-get update && apt-get install -y git unzip curl && rm -rf /var/lib/apt/lists/*

# Install lua-resty-openidc dependency manually (luarocks has manifest size issues)
RUN git clone --depth 1 --branch ${LUA_RESTY_OPENIDC_VERSION} https://github.com/zmartzone/lua-resty-openidc.git /tmp/lua-resty-openidc && \\
    cd /tmp/lua-resty-openidc && \\
    cp -r lib/resty/* /usr/local/share/lua/5.1/resty/ && \\
    mkdir -p /usr/local/share/licenses/lua-resty-openidc && \\
    cp LICENSE.txt /usr/local/share/licenses/lua-resty-openidc/ && \\
    rm -rf /tmp/lua-resty-openidc

# Install kong-oidc-v3 plugin manually (shallow fetch of the pinned commit)
RUN mkdir -p /tmp/kong-oidc-v3 && \\
    cd /tmp/kong-oidc-v3 && \\
    git init -q && \\
    git fetch -q --depth 1 https://github.com/Gate1106/kong-oidc-v3.git ${KONG_OIDC_V3_COMMIT} && \\
    git checkout -q FETCH_HEAD && \\
    mkdir -p /usr/local/share/lua/5.1/kong/plugins/oidc && \\
    cp -r /tmp/kong-oidc-v3/kong/plugins/oidc/* /usr/local/share/lua/5.1/kong/plugins/oidc/ && \\
    mkdir -p /usr/local/share/licenses/kong-oidc-v3 && \\
    cp LICENSE /usr/local/share/licenses/kong-oidc-v3/ && \\
    rm -rf /tmp/kong-oidc-v3

${buildOidcLogLevelPatch()}`;
}
