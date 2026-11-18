/**
 * Build the LuaRocks spec of one framework Kong plugin for the public
 * plugins repo: the package `<plugin>` at `<version>-1`, its source the
 * repo's tag `v<version>`, each Lua file a module under
 * `kong.plugins.<plugin>` (the repo keeps them in `kong/plugins/<plugin>/`).
 */

import {
  KONG_BASE_IMAGE,
  KONG_FRAMEWORK_PLUGIN_SUMMARIES,
  KONG_PLUGINS_REPO_URL,
} from '../../constants';

export function buildKongPluginRockspec(params: {
  plugin: string;
  /** The plugin's Lua files, relative to its folder */
  files: string[];
  version: string;
}): string {
  const { plugin, files, version } = params;
  const kongVersion = KONG_BASE_IMAGE.split(':')[1] ?? '';
  const summary =
    KONG_FRAMEWORK_PLUGIN_SUMMARIES[plugin] ?? `The ${plugin} Kong plugin`;

  const modules = [...files]
    .filter((file) => file.endsWith('.lua'))
    .sort()
    .map((file) => {
      const module = file
        .replace(/\.lua$/, '')
        .split('/')
        .join('.');
      return `    ["kong.plugins.${plugin}.${module}"] = "kong/plugins/${plugin}/${file}",`;
    })
    .join('\n');

  return `rockspec_format = "3.0"
package = "${plugin}"
version = "${version}-1"
source = {
  url = "git+${KONG_PLUGINS_REPO_URL}.git",
  tag = "v${version}",
}
description = {
  summary = "${summary.replace(/"/g, '\\"')}",
  detailed = "A Kong plugin from tsdevstack. Tested with Kong ${kongVersion} (open source).",
  homepage = "${KONG_PLUGINS_REPO_URL}",
  license = "Apache-2.0",
}
dependencies = {
  "lua >= 5.1",
}
build = {
  type = "builtin",
  modules = {
${modules}
  },
}
`;
}
