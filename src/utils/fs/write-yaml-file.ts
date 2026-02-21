/**
 * Write an object to a YAML file
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { CliError } from '../errors';

/**
 * Write an object to a YAML file
 *
 * @param filePath - Path to write YAML file
 * @param data - Data to serialize to YAML
 * @param options - Optional YAML dump options
 * @throws CliError if YAML serialization or write operation fails
 */
export function writeYamlFile(
  filePath: string,
  data: unknown,
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
    fs.writeFileSync(filePath, yamlContent, 'utf-8');
  } catch (error) {
    throw new CliError(
      `Failed to write YAML file: ${filePath}\n${error instanceof Error ? error.message : error}`,
      'YAML write failed',
      'Ensure the file path is valid and writable'
    );
  }
}