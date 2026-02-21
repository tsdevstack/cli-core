#!/usr/bin/env node

/**
 * Generate TypeScript API client from OpenAPI specification
 *
 * This script generates a typed API client with version-based grouping
 * using swagger-typescript-api
 *
 * Usage:
 *   npx tsdevstack generate-client [service-name] [--input <path>]
 *   npx tsdevstack generate-client auth-service (uses ./docs/openapi.json by default)
 *   npx tsdevstack generate-client auth-service --input ./custom/path.json
 *   npx tsdevstack generate-client (auto-detect service from current directory)
 *
 * Client package name is automatically derived from service name using the naming convention:
 *   service-name → service-name-client
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import { readPackageJsonFrom, extractAuthor } from '../utils/fs/index';
import { validateServiceComplete } from '../utils/validation';
import { CliError } from '../utils/errors';
import {
  getCliPaths,
  getServicePath,
  getClientPath,
} from '../utils/paths/index';
import { renderTemplate } from '../utils/template/render-template';
import {
  deleteFolderRecursive,
  cleanupFolder,
  ensureDirectory,
  isFile,
} from '../utils/fs/index';
import { executeCommand, executeNpmCommand } from '../utils/exec';
import { resolveServiceNameInteractive } from '../utils/service/resolve-service-name-interactive';
import { logger } from '../utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface GenerateClientOptions {
  /** Path to OpenAPI spec file (defaults to ./docs/openapi.json) */
  input?: string;
  /** Module name index for version-based grouping (default: 1) */
  moduleNameIndex?: number;
  /** Optional service name (if not provided, will be resolved) */
  serviceName?: string;
}

/**
 * Generate TypeScript API client from OpenAPI spec
 */
export async function generateClient(
  options: GenerateClientOptions,
): Promise<void> {
  const {
    input = './docs/openapi.json',
    moduleNameIndex = 1,
    serviceName: serviceNameArg,
  } = options;

  // Resolve service name
  const serviceName = await resolveServiceNameInteractive(serviceNameArg);

  // Get service directory
  const serviceDir = getServicePath(serviceName);

  // Resolve input path (if relative, make it relative to service directory)
  const inputPath = path.isAbsolute(input)
    ? input
    : path.resolve(serviceDir, input);

  // Validate input file exists
  if (!isFile(inputPath)) {
    throw new CliError(
      'OpenAPI specification not found',
      `Path: ${inputPath}`,
      'Generate it first: npm run docs:generate',
    );
  }

  // Read service info from package.json
  logger.reading('Reading service info from package.json...');
  logger.newline();
  const packageJson = readPackageJsonFrom(serviceDir);
  const author = extractAuthor(packageJson);

  // Validate service completely before proceeding
  validateServiceComplete(serviceName); // fail fast on first error

  // Derive client package name using naming convention: service-name → service-name-client
  const clientPackageName = `${serviceName}-client`;

  logger.info(`   Service: ${serviceName}`);
  logger.info(`   Client:  ${clientPackageName}`);
  logger.info(`   Author:  ${author}`);
  logger.newline();

  logger.generating(`TypeScript client from ${inputPath}...`);
  logger.newline();

  // Use functional path helpers for all path resolution
  const packageDir = getClientPath(serviceName);
  const output = path.join(packageDir, 'src');
  const distPath = path.join(packageDir, 'dist');

  // __dirname is dist/, templates are in dist/templates/
  const cliPaths = getCliPaths(__dirname);

  // Clean dist folder before generation to avoid stale files
  deleteFolderRecursive(distPath);

  // Ensure package directory exists
  ensureDirectory(packageDir);

  // Template data
  const templateData = {
    packageName: `@shared/${clientPackageName}`,
    serviceName,
    author,
  };

  // Path to templates
  const templatesDir = cliPaths.templatesDir;
  const packageJsonTemplate = path.join(
    templatesDir,
    'client-package.json.hbs',
  );
  const tsconfigTemplate = path.join(templatesDir, 'client-tsconfig.json.hbs');
  const indexTemplate = path.join(templatesDir, 'index.ts.hbs');

  // Ensure output directory exists
  ensureDirectory(output);

  // Generate package.json, tsconfig.json, and index.ts
  renderTemplate(
    packageJsonTemplate,
    path.join(packageDir, 'package.json'),
    templateData,
  );
  renderTemplate(tsconfigTemplate, path.join(packageDir, 'tsconfig.json'));
  renderTemplate(indexTemplate, path.join(output, 'index.ts'));

  logger.success('Created package.json, tsconfig.json, and index.ts');

  // 1) Generate client code (interfaces + API client)
  const clientArgs = [
    'swagger-typescript-api',
    'generate',
    `-p ${inputPath}`,
    `-o ${output}`,
    '--axios',
    '--route-types',
    '--extract-request-params',
    '--class-transformers',
    `--module-name-index ${moduleNameIndex}`,
  ];

  const clientCommand = `npx ${clientArgs.join(' ')}`;

  executeCommand(clientCommand, {
    logCommand: true,
  });

  logger.newline();
  logger.success(`Client generated successfully at ${output}`);

  // 2) Generate DTO classes with decorators
  const dtoOut = path.join(packageDir, 'dto');
  const dtoTemplates = cliPaths.swaggerTemplatesDir;

  ensureDirectory(dtoOut);

  const dtoArgs = [
    'swagger-typescript-api',
    'generate',
    `-p ${inputPath}`,
    `-o ${dtoOut}`,
    '--modular',
    `--templates ${dtoTemplates}`,
    `--name index.ts`,
    `--module-name-index ${moduleNameIndex}`,
  ];

  const dtoCommand = `npx ${dtoArgs.join(' ')}`;

  executeCommand(dtoCommand, {
    logCommand: true,
  });

  logger.newline();
  logger.success(`DTOs generated successfully at ${dtoOut}`);

  // Clean up unnecessary files from dto folder
  cleanupFolder(dtoOut, ['data-contracts.ts']);

  // Build the client package
  logger.newline();
  logger.building('Building client package...');
  logger.newline();
  try {
    executeNpmCommand('build', packageDir);
    logger.newline();
    logger.success('Client package built successfully!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CliError(
      `Client package build failed: ${errorMessage}`,
      `Package: ${templateData.packageName}`,
      'Client generated but TypeScript compilation failed. Check the error above.',
    );
  }

  logger.newline();
  logger.complete('Client generation complete!');
  logger.info(`   Package: ${templateData.packageName}`);
  logger.info(`   Location: ${packageDir}`);
}
