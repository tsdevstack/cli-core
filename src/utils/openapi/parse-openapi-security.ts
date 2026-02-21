/**
 * Main entry point for parsing OpenAPI security metadata
 */

import { loadOpenApiDocument } from "./load-openapi-document";
import { extractRouteSecurityInfo } from "./extract-route-security";
import {
  groupRoutesBySecurity,
  type GroupedRoutes,
} from "./group-routes-by-security";
import { logger } from "../logger";

export interface ParsedServiceSecurity {
  serviceName: string;
  openApiPath: string;
  groupedRoutes: GroupedRoutes;
}

/**
 * Parses OpenAPI document and extracts security information for all routes.
 *
 * @param serviceName - Name of the service
 * @param openApiPath - Absolute path to service's openapi.json
 * @returns Parsed security information grouped by type
 */
export function parseOpenApiSecurity(
  serviceName: string,
  openApiPath: string
): ParsedServiceSecurity {
  logger.debug(
    `Parsing OpenAPI security for ${serviceName} from ${openApiPath}`
  );

  const document = loadOpenApiDocument(openApiPath);
  const routes = extractRouteSecurityInfo(document);
  const groupedRoutes = groupRoutesBySecurity(routes);

  logger.info(
    `Parsed ${serviceName}: ${groupedRoutes.public.length} public, ` +
      `${groupedRoutes.jwt.length} JWT, ${groupedRoutes.partner.length} partner routes`
  );

  return {
    serviceName,
    openApiPath,
    groupedRoutes,
  };
}