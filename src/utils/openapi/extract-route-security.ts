/**
 * Extracts security information from OpenAPI routes
 */

import { HTTP_METHODS } from '../../constants';
import type { OpenApiDocument, RouteSecurityInfo, SecurityType } from './types';

/**
 * Extracts security information for all routes in an OpenAPI document.
 *
 * @param document - Parsed OpenAPI document
 * @returns Array of route security information
 */
export function extractRouteSecurityInfo(
  document: OpenApiDocument
): RouteSecurityInfo[] {
  const routes: RouteSecurityInfo[] = [];

  for (const [path, pathItem] of Object.entries(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];

      if (!operation) {
        continue;
      }

      const securityTypes = determineSecurityTypes(operation.security);

      // Add route for each security type (supports dual-access: JWT + Partner)
      for (const securityType of securityTypes) {
        routes.push({
          path,
          method: method.toUpperCase(),
          securityType,
        });
      }
    }
  }

  return routes;
}

/**
 * Determines the security types based on OpenAPI security requirements.
 *
 * IMPORTANT: @PartnerApi() is ADDITIVE, not exclusive.
 * - @ApiBearerAuth() alone → JWT route only
 * - @PartnerApi() alone → Partner route only
 * - @ApiBearerAuth() + @PartnerApi() → TWO routes (JWT + Partner)
 * - @Public() → Public route only
 *
 * When both bearer and api-key are present, this function returns BOTH security types,
 * causing the route to be added to both JWT and Partner groups in Kong configuration.
 * This creates dual-access: same endpoint accessible via different URLs with different auth.
 *
 * @param security - Security requirements from operation
 * @returns Array of security types (can contain multiple for dual-access)
 */
function determineSecurityTypes(
  security: Array<Record<string, string[]>> | undefined
): SecurityType[] {
  // No security requirement = public
  if (!security || security.length === 0) {
    return ["public"];
  }

  // Check what security schemes are required
  const hasBearer = security.some((req) => "bearer" in req);
  const hasApiKey = security.some((req) => "api-key" in req);

  // Dual-access: Both JWT and Partner API
  // Creates two Kong routes:
  // - /service/v1/endpoint (JWT via OIDC plugin)
  // - /api/service/v1/endpoint (API key via key-auth plugin)
  if (hasBearer && hasApiKey) {
    return ["jwt", "partner"];
  }

  // Single security type
  if (hasBearer) {
    return ["jwt"];
  }

  if (hasApiKey) {
    return ["partner"];
  }

  // Has security but neither bearer nor api-key (could be other schemes)
  // Treat as public for now
  return ["public"];
}
