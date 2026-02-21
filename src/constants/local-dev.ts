/**
 * Local development environment constants
 */

/**
 * Local development Redis configuration
 * NestJS services run on host, so they use localhost
 */
export const LOCAL_REDIS_HOST = 'localhost';

/**
 * Kong-specific Redis host (Kong runs in Docker, uses service name)
 */
export const KONG_REDIS_HOST = 'redis';
export const LOCAL_REDIS_PORT = '6379';
export const LOCAL_REDIS_PASSWORD = 'redis_pass';

/**
 * Kong/Docker service host for local development
 */
export const KONG_SERVICE_HOST = 'http://host.docker.internal';

/**
 * Kong Gateway URL for local development
 * This is the URL that frontends and external clients use to access the API
 */
export const KONG_GATEWAY_URL = 'http://localhost:8000';

/**
 * Kong OIDC SSL verification setting for local development
 * Set to 'no' for local dev (no SSL certificates to verify)
 * Cloud deployment should use 'yes' (verify SSL certificates)
 */
export const KONG_SSL_VERIFY = 'no';
