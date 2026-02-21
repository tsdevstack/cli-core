/**
 * Save framework configuration to .tsdevstack/config.json
 */

import { writeJsonFile } from "../fs";
import { getConfigPath } from "../paths";
import type { FrameworkConfig } from "./types";

/**
 * Save framework configuration to .tsdevstack/config.json
 *
 * Automatically finds the project root and saves the config.
 *
 * @param config - Framework configuration object
 */
export function saveFrameworkConfig(config: FrameworkConfig): void {
  const configPath = getConfigPath();
  writeJsonFile(configPath, config);
}