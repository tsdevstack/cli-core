/**
 * Stage the framework and project Kong plugins into a Kong build context
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  KONG_FRAMEWORK_PLUGINS_TEMPLATE_DIR,
  KONG_PLUGINS_DIR,
} from '../../constants';
import { resolveCliAssetDir } from '../paths/resolve-cli-asset-dir';
import { buildKongPluginList } from './build-kong-plugin-list';
import { listKongPluginDirs } from './list-kong-plugin-dirs';
import { validateKongPluginDirs } from './validate-kong-plugin-dirs';

export interface StageKongPluginsOptions {
  /** Project root (its kong-plugins/ folder holds the project plugins) */
  projectRoot: string;
  /** Kong build context directory */
  contextDir: string;
}

/**
 * Replaces `<contextDir>/kong-plugins/` with a fresh copy of the framework
 * plugins (shipped with the CLI) and the project plugins
 * (`<projectRoot>/kong-plugins/*`).
 *
 * Invalid plugin folders and name collisions fail before anything is
 * removed or copied. Symlinked plugin folders and files are copied as their
 * targets (the Docker build context cannot follow links).
 *
 * @returns The full KONG_PLUGINS list for the image
 */
export function stageKongPlugins(options: StageKongPluginsOptions): string[] {
  const frameworkDir = resolveCliAssetDir(KONG_FRAMEWORK_PLUGINS_TEMPLATE_DIR);
  const userDir = path.join(options.projectRoot, KONG_PLUGINS_DIR);

  const frameworkPlugins = listKongPluginDirs(frameworkDir);
  const userPlugins = listKongPluginDirs(userDir);

  validateKongPluginDirs([
    ...frameworkPlugins.map((name) => ({
      name,
      dir: path.join(frameworkDir, name),
    })),
    ...userPlugins.map((name) => ({ name, dir: path.join(userDir, name) })),
  ]);

  const kongPlugins = buildKongPluginList({ frameworkPlugins, userPlugins });

  const targetDir = path.join(options.contextDir, KONG_PLUGINS_DIR);
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });

  for (const name of frameworkPlugins) {
    fs.cpSync(path.join(frameworkDir, name), path.join(targetDir, name), {
      recursive: true,
      dereference: true,
    });
  }
  for (const name of userPlugins) {
    fs.cpSync(path.join(userDir, name), path.join(targetDir, name), {
      recursive: true,
      dereference: true,
    });
  }

  return kongPlugins;
}
