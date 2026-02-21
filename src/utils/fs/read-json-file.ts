/**
 * Read a JSON file and parse it
 *
 * @param filePath - Path to JSON file
 * @returns Parsed JSON object
 * @throws CliError if file not found or invalid JSON
 */

import * as fs from 'fs';
import { CliError } from '../errors';
import { isFile } from './is-file';

export function readJsonFile<T = unknown>(filePath: string): T {
  if (!isFile(filePath)) {
    throw new CliError(
      `Path is not a file: ${filePath}`,
      'JSON file not found',
      'Ensure the JSON file exists'
    );
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new CliError(
      `Failed to read or parse JSON file: ${filePath}\n${error instanceof Error ? error.message : error}`,
      'Invalid JSON',
      'Ensure the file contains valid JSON'
    );
  }
}