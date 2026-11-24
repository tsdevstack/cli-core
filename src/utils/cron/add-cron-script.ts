/**
 * Add the `cron` script to a service's package.json (`npm run cron -- <name>`
 * runs one handler locally). A script that already exists is left as it
 * is, whatever it runs.
 */

import * as fs from 'fs';
import { CRON_SCRIPTS } from '../../constants';

export interface AddCronScriptResult {
  /** Scripts added now */
  added: string[];
  /** Scripts that were already there and were left alone */
  kept: string[];
}

/**
 * @param packageJsonPath - The service's package.json
 */
export function addCronScript(packageJsonPath: string): AddCronScriptResult {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as {
    scripts?: Record<string, string>;
  };
  const scripts = pkg.scripts ?? {};
  const added: string[] = [];
  const kept: string[] = [];

  for (const [name, command] of Object.entries(CRON_SCRIPTS)) {
    if (name in scripts) {
      kept.push(name);
      continue;
    }
    scripts[name] = command;
    added.push(name);
  }

  if (added.length > 0) {
    pkg.scripts = scripts;
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  return { added, kept };
}
