/**
 * Generate Kong Gateway service configuration
 */

import type { DockerComposeServices } from '../types';
import {
  KONG_LOCAL_CLIENT_MAX_BODY_SIZE,
  KONG_RUNTIME_SECRETS,
} from '../../../constants';

/**
 * The image is built from the generated infrastructure/kong/Dockerfile, whose
 * defaults are the cloud settings (proxy 8080, Admin API off, baked config).
 * Local development overrides them here: proxy 8000, Admin API 8001, the
 * mounted kong.yml, and Kong's default request body limit (unlimited)
 * instead of the cloud maxUploadSize baked into the image. Kong's runtime
 * secrets come from the root .env, as in the cloud they come from the secret
 * store.
 *
 * The image is named after the project, so tsdevstack projects on one
 * machine never build into (or remove) each other's Kong image.
 */
export function generateKongService(
  networkName: string,
  projectName: string,
): DockerComposeServices {
  return {
    gateway: {
      build: {
        context: './infrastructure/kong',
        dockerfile: 'Dockerfile',
      },
      image: `${projectName}-kong:latest`,
      environment: {
        KONG_DATABASE: 'off',
        KONG_DECLARATIVE_CONFIG: '/kong/kong.yml',
        KONG_PROXY_ACCESS_LOG: '/dev/stdout',
        KONG_ADMIN_ACCESS_LOG: '/dev/stdout',
        KONG_PROXY_ERROR_LOG: '/dev/stderr',
        KONG_ADMIN_ERROR_LOG: '/dev/stderr',
        KONG_ADMIN_LISTEN: '0.0.0.0:8001',
        KONG_PROXY_LISTEN: '0.0.0.0:8000',
        KONG_NGINX_HTTP_CLIENT_MAX_BODY_SIZE: KONG_LOCAL_CLIENT_MAX_BODY_SIZE,
        // Kong's runtime secrets, from the root .env: kong.yml references them
        // ({vault://env/redis-password}) instead of holding the values
        ...Object.fromEntries(
          KONG_RUNTIME_SECRETS.map((key) => [key, `\${${key}}`]),
        ),
      },
      volumes: ['./kong.yml:/kong/kong.yml:ro'],
      ports: ['8000:8000', '8001:8001'],
      networks: [networkName],
      depends_on: ['redis'],
      healthcheck: {
        test: ['CMD', 'kong', 'health'],
        interval: '10s',
        timeout: '5s',
        retries: 5,
      },
    },
  };
}
