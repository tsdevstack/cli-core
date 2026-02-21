/**
 * Loads and parses an OpenAPI document from a JSON file.
 */

import { readJsonFile } from "../fs/read-json-file";
import type { OpenApiDocument } from "./types";

/**
 * Loads and parses an OpenAPI document from a JSON file.
 *
 * @param openApiPath - Absolute path to openapi.json
 * @returns Parsed OpenAPI document
 * @throws Error if file doesn't exist or is invalid JSON
 */
export function loadOpenApiDocument(openApiPath: string): OpenApiDocument {
  const document = readJsonFile<OpenApiDocument>(openApiPath);

  if (!document.openapi || !document.paths) {
    throw new Error(
      `Invalid OpenAPI document at ${openApiPath}: missing required fields (openapi, paths)`
    );
  }

  return document;
}
