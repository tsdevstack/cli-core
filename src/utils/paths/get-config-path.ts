/**
 * Get absolute path to framework configuration file
 */

import * as path from "path";
import { findProjectRoot } from "./find-project-root";
import { TSDEVSTACK_DIR, CONFIG_FILENAME } from "../../constants";

/**
 * Get absolute path to .tsdevstack/config.json
 *
 * @param root - Project root directory (defaults to findProjectRoot())
 * @returns Absolute path to config.json
 *
 * @example
 * const configPath = getConfigPath();
 * // Returns: /path/to/project/.tsdevstack/config.json
 */
export function getConfigPath(root: string = findProjectRoot()): string {
  return path.join(root, TSDEVSTACK_DIR, CONFIG_FILENAME);
}
