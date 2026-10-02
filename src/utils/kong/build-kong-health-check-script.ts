/**
 * Build the Dockerfile snippet that installs the Kong health check script
 */

/**
 * Returns the Dockerfile RUN step that writes /usr/local/bin/kong-health-check.sh
 *
 * The script checks Kong readiness only (status API on 8100). It does not
 * wait for backends: the OIDC plugin fetches the discovery document on the
 * first authenticated request, on every provider.
 *
 * The script is only used by cloud health checks; local compose uses `kong health`.
 */
export function buildKongHealthCheckScript(): string {
  return `# Health check script
RUN echo '#!/bin/sh' > /usr/local/bin/kong-health-check.sh && \\
    echo 'curl -sf http://localhost:8100/status/ready || exit 1' >> /usr/local/bin/kong-health-check.sh && \\
    chmod +x /usr/local/bin/kong-health-check.sh
`;
}
