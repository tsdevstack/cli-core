/**
 * OpenAPI document types for parsing security metadata
 */

/**
 * OpenAPI 3.0 document structure (minimal types for security parsing)
 */
export interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, PathItem>;
  components?: {
    securitySchemes?: Record<string, SecurityScheme>;
  };
}

/**
 * OpenAPI path item containing HTTP operations
 */
export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  options?: Operation;
  head?: Operation;
}

/**
 * OpenAPI operation (endpoint) definition
 */
export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  security?: Array<Record<string, string[]>>;
  tags?: string[];
}

/**
 * OpenAPI security scheme definition
 */
export interface SecurityScheme {
  type: string;
  scheme?: string;
  name?: string;
  in?: string;
}

/**
 * Parsed security metadata for Kong route generation
 */
export type SecurityType = "public" | "jwt" | "partner";

/**
 * Security information for a single route
 */
export interface RouteSecurityInfo {
  path: string;
  method: string;
  securityType: SecurityType;
}

/**
 * Map of service names to their security information
 */
export interface ServiceSecurityMap {
  [serviceName: string]: RouteSecurityInfo[];
}