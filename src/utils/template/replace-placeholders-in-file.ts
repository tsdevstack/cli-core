/**
 * Replace placeholder strings in a file using regex-based replacement
 *
 * Reads the file, replaces all occurrences of each placeholder key with its value,
 * and writes the result back. Silently skips if the file does not exist.
 *
 * @param filePath - Absolute path to the file
 * @param replacements - Map of regex patterns to replacement values
 */

import * as fs from 'fs';

export function replacePlaceholdersInFile(
  filePath: string,
  replacements: Record<string, string>,
): void {
  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.replace(new RegExp(placeholder, 'g'), value);
  }

  fs.writeFileSync(filePath, content, 'utf-8');
}
