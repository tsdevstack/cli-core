/**
 * Write the generated part of the public plugins repo into a folder: the
 * framework plugins (as the CLI ships them) under `kong/plugins/<plugin>/`,
 * one LuaRocks spec per plugin under `rockspecs/`, and the image's
 * `Dockerfile`, all at KONG_PLUGINS_VERSION. Hidden files and folders
 * (.DS_Store, editor folders) are left out. The hand-written files
 * (README, LICENSE, CHANGELOG) come from the monorepo's `kong-plugins/`;
 * the release scripts put the two together.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  KONG_FRAMEWORK_PLUGINS_TEMPLATE_DIR,
  KONG_PLUGINS_VERSION,
} from '../../constants';
import { resolveCliAssetDir } from '../paths/resolve-cli-asset-dir';
import { buildKongPluginRockspec } from './build-kong-plugin-rockspec';
import { generateKongPluginsImageDockerfile } from './generate-kong-plugins-image-dockerfile';
import { listKongPluginDirs } from './list-kong-plugin-dirs';

export function writeKongPluginsPackage(params: {
  outDir: string;
  /** For tests: the plugins folder (default: the one the CLI ships) */
  pluginsDir?: string;
}): { version: string; plugins: string[] } {
  const pluginsDir =
    params.pluginsDir ??
    resolveCliAssetDir(KONG_FRAMEWORK_PLUGINS_TEMPLATE_DIR);
  const version = KONG_PLUGINS_VERSION;
  const plugins = listKongPluginDirs(pluginsDir);

  const pluginsOut = path.join(params.outDir, 'kong', 'plugins');
  const rockspecsOut = path.join(params.outDir, 'rockspecs');
  fs.rmSync(pluginsOut, { recursive: true, force: true });
  fs.rmSync(rockspecsOut, { recursive: true, force: true });
  fs.mkdirSync(pluginsOut, { recursive: true });
  fs.mkdirSync(rockspecsOut, { recursive: true });

  const listFiles = (dir: string, prefix = ''): string[] =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.'))
      .flatMap((entry) => {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        return entry.isDirectory()
          ? listFiles(path.join(dir, entry.name), relative)
          : [relative];
      });

  for (const plugin of plugins) {
    const source = path.join(pluginsDir, plugin);
    fs.cpSync(source, path.join(pluginsOut, plugin), {
      recursive: true,
      dereference: true,
      filter: (file) => !path.basename(file).startsWith('.'),
    });
    fs.writeFileSync(
      path.join(rockspecsOut, `${plugin}-${version}-1.rockspec`),
      buildKongPluginRockspec({ plugin, files: listFiles(source), version }),
    );
  }

  fs.writeFileSync(
    path.join(params.outDir, 'Dockerfile'),
    generateKongPluginsImageDockerfile({ plugins, version }),
  );

  return { version, plugins };
}
