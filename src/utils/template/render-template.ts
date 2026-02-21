/**
 * Render a Handlebars template from file and write to output
 */

import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { CliError } from '../errors';
import { ensureDirectory } from '../fs';
import { logger } from '../logger';

/**
 * Render a Handlebars template from file and write to output
 *
 * @param templatePath - Path to .hbs template file
 * @param outputPath - Path to write rendered output
 * @param data - Template variables
 * @param silent - Don't log success message (default: false)
 *
 * @throws {CliError} If template file is not found
 *
 * @example
 * renderTemplate(
 *   '/path/to/template.hbs',
 *   '/path/to/output.ts',
 *   { name: 'MyService' }
 * );
 */
export function renderTemplate(
  templatePath: string,
  outputPath: string,
  data?: Record<string, unknown>,
  silent: boolean = false,
): void {
  if (!fs.existsSync(templatePath)) {
    throw new CliError(
      `Template file not found: ${templatePath}`,
      'Template error',
      'Please ensure the template file exists at the specified path.',
    );
  }

  const templateContent = fs.readFileSync(templatePath, 'utf-8');
  const template = Handlebars.compile(templateContent);
  const rendered = template(data || {});

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  ensureDirectory(outputDir);

  fs.writeFileSync(outputPath, rendered, 'utf-8');

  if (!silent) {
    logger.success(`Created ${path.basename(outputPath)}`);
  }
}
