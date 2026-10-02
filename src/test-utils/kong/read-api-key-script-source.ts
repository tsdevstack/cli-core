/**
 * Read the Redis script the tsdevstack-api-key Kong plugin ships
 */

import * as fs from 'fs';
import * as path from 'path';
import { getApiKeyPluginDir } from './get-api-key-plugin-dir';

const SOURCE_PATTERN = /local SOURCE = \[==\[\n([\s\S]*?)\]==\]/g;

/**
 * Returns the exact Redis Lua script embedded in the plugin's script.lua
 * (the long string between `local SOURCE = [==[` and `]==]`; Lua drops the
 * newline right after the opening bracket, so the value starts after it).
 *
 * @throws Error when script.lua does not contain exactly one SOURCE block
 */
export function readApiKeyScriptSource(): string {
  const file = fs.readFileSync(
    path.join(getApiKeyPluginDir(), 'script.lua'),
    'utf-8',
  );
  const matches = [...file.matchAll(SOURCE_PATTERN)];
  if (matches.length !== 1) {
    throw new Error(
      `Expected one SOURCE block in script.lua, found ${matches.length}`,
    );
  }
  return matches[0][1];
}
