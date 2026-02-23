/**
 * Replace placeholders in monorepo template files
 *
 * Replaces {{PROJECT_NAME}} and {{CLI_VERSION}} in the cloned monorepo template.
 */

import { join } from 'path';
import { replacePlaceholdersInFile } from '../template';

export function replaceMonorepoPlaceholders(
  projectDir: string,
  projectName: string,
  cliVersion: string,
): void {
  const replacements: Record<string, string> = {
    '\\{\\{PROJECT_NAME\\}\\}': projectName,
    '\\{\\{CLI_VERSION\\}\\}': cliVersion,
  };

  const filesToProcess = [
    'package.json',
    join('.tsdevstack', 'config.json'),
    'README.md',
  ];

  for (const file of filesToProcess) {
    const filePath = join(projectDir, file);
    replacePlaceholdersInFile(filePath, replacements);
  }
}
