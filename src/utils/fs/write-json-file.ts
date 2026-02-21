/**
 * Write an object to a JSON file with formatting
 *
 * @param filePath - Path to JSON file
 * @param data - Data to write
 * @throws CliError if write operation fails
 */

import * as fs from 'fs';
import { CliError } from '../errors';

export function writeJsonFile(filePath: string, data: unknown): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  } catch (error) {
    throw new CliError(
      `Failed to write JSON file: ${filePath}\n${error instanceof Error ? error.message : error}`,
      'JSON write failed',
      'Ensure you have write permissions and the directory exists'
    );
  }
}