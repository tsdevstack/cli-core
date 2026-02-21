/**
 * Write an object to a YAML file with a header comment
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { CliError } from '../errors';

/**
 * Write an object to a YAML file with a header comment
 *
 * @param filePath - Path to write YAML file
 * @param data - Data to serialize to YAML
 * @param header - Header comment to prepend (should include # characters)
 * @param options - Optional YAML dump options
 * @throws CliError if YAML serialization or write operation fails
 */
export function writeYamlFileWithHeader(
  filePath: string,
  data: unknown,
  header: string,
  options?: yaml.DumpOptions
): void {
  try {
    const defaultOptions: yaml.DumpOptions = {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      ...options,
    };

    const yamlContent = yaml.dump(data, defaultOptions);
    const output = header + yamlContent;
    fs.writeFileSync(filePath, output, 'utf-8');
  } catch (error) {
    throw new CliError(
      `Failed to write YAML file with header: ${filePath}\n${error instanceof Error ? error.message : error}`,
      'YAML write failed',
      'Ensure the file path is valid and writable'
    );
  }
}