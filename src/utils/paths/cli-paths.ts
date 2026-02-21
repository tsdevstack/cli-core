/**
 * CLI-specific paths (templates, etc.)
 *
 * These are relative to the CLI package, not the project.
 */

import * as path from 'path';

/**
 * CLI-specific paths (templates, etc.)
 *
 * These are relative to the CLI package, not the project
 */
export class CliPaths {
  constructor(private cliDir: string) {}

  get templatesDir(): string {
    return path.join(this.cliDir, 'templates');
  }

  get swaggerTemplatesDir(): string {
    return path.join(this.cliDir, 'swagger-ts-templates');
  }

  getTemplate(templateName: string): string {
    return path.join(this.templatesDir, templateName);
  }
}

/**
 * Get CLI-specific paths
 *
 * @param cliDir - CLI package directory (usually __dirname from the calling file)
 * @returns CliPaths instance
 */
export function getCliPaths(cliDir: string): CliPaths {
  // With rslib, templates are copied to dist/ during build
  // No need for dist-to-src conversion anymore
  return new CliPaths(cliDir);
}