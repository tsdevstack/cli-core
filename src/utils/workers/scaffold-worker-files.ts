/**
 * Create a detached worker's files in its base service: src/worker.ts,
 * src/worker.module.ts and tsconfig.worker.json, from the CLI's templates.
 * A file that already exists is never overwritten.
 */

import * as fs from 'fs';
import * as path from 'path';
import { WORKER_SCAFFOLD_FILES, WORKER_TEMPLATE_DIR } from '../../constants';
import { resolveCliAssetDir } from '../paths/resolve-cli-asset-dir';

export interface ScaffoldWorkerFilesResult {
  /** Files written now, relative to the service's folder */
  created: string[];
  /** Files that were already there and were left alone */
  kept: string[];
}

/**
 * @param serviceDir - The base service's folder (apps/{service})
 * @param templateDir - Where the templates are (default: the CLI's)
 */
export function scaffoldWorkerFiles(
  serviceDir: string,
  templateDir: string = resolveCliAssetDir(WORKER_TEMPLATE_DIR),
): ScaffoldWorkerFilesResult {
  const created: string[] = [];
  const kept: string[] = [];

  for (const { template, target } of WORKER_SCAFFOLD_FILES) {
    const targetPath = path.join(serviceDir, target);
    if (fs.existsSync(targetPath)) {
      kept.push(target);
      continue;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(
      targetPath,
      fs.readFileSync(path.join(templateDir, template), 'utf-8'),
    );
    created.push(target);
  }

  return { created, kept };
}
