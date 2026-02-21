/**
 * Write text content to a file
 *
 * @param filePath - Path to file
 * @param content - Text content to write
 * @throws CliError if write operation fails
 */

import * as fs from 'fs';
import { CliError } from '../errors';

export function writeTextFile(filePath: string, content: string): void {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (error) {
    throw new CliError(
      `Failed to write file: ${filePath}\n${error instanceof Error ? error.message : error}`,
      'File write failed',
      'Ensure you have write permissions and the directory exists'
    );
  }
}