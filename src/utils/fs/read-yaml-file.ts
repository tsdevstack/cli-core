/**
 * Read and parse a YAML file
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { CliError } from '../errors';
import { isFile } from './is-file';

/**
 * Read and parse a YAML file
 *
 * @param filePath - Path to YAML file
 * @returns Parsed YAML object
 * @throws CliError if file not found or invalid YAML
 */
export function readYamlFile<T = unknown>(filePath: string): T {
  if (!isFile(filePath)) {
    throw new CliError(
      `Path is not a file: ${filePath}`,
      'YAML file not found',
      'Ensure the YAML file exists'
    );
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return yaml.load(content) as T;
  } catch (error) {
    throw new CliError(
      `Failed to read or parse YAML file: ${filePath}\n${error instanceof Error ? error.message : error}`,
      'Invalid YAML',
      'Ensure the file contains valid YAML syntax'
    );
  }
}