/**
 * Create a cron job's files in its service: the shared src/cron.ts,
 * src/cron.module.ts and tsconfig.cron.json when they are missing, and the
 * job's handler src/cron/{name}.cron.ts, from the CLI's templates. A file
 * that already exists is never overwritten: the module lists the first
 * handler only, later handlers are added by the user (the command prints
 * the two lines).
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  CRON_HANDLER_DIR,
  CRON_HANDLER_SUFFIX,
  CRON_HANDLER_TEMPLATE,
  CRON_MODULE_FILE,
  CRON_SCAFFOLD_FILES,
  CRON_TEMPLATE_DIR,
  PRISMA_MODULE_FILE,
} from '../../constants';
import { resolveCliAssetDir } from '../paths/resolve-cli-asset-dir';
import { buildCronClassName } from './build-cron-class-name';
import { fillCronTemplate } from './fill-cron-template';

export interface ScaffoldCronFilesResult {
  /** Files written now, relative to the service's folder */
  created: string[];
  /** Files that were already there and were left alone */
  kept: string[];
  /** Whether src/cron.module.ts was written now (it then lists the handler) */
  moduleCreated: boolean;
  /** The handler file, relative to the service's folder */
  handlerFile: string;
  /** The handler's class name */
  className: string;
}

/**
 * @param serviceDir - The service's folder (apps/{service})
 * @param serviceName - The service's name, for the handler's comment
 * @param jobName - The cron job's name (kebab-case, validated)
 * @param templateDir - Where the templates are (default: the CLI's)
 */
export function scaffoldCronFiles(
  serviceDir: string,
  serviceName: string,
  jobName: string,
  templateDir: string = resolveCliAssetDir(CRON_TEMPLATE_DIR),
): ScaffoldCronFilesResult {
  const className = buildCronClassName(jobName);
  const hasPrisma = fs.existsSync(path.join(serviceDir, PRISMA_MODULE_FILE));
  const values: Record<string, string> = {
    CRON_JOB_NAME: jobName,
    CRON_CLASS_NAME: className,
    SERVICE_NAME: serviceName,
    PRISMA_IMPORT: hasPrisma
      ? "\nimport { PrismaModule } from './prisma/prisma.module';"
      : '',
    PRISMA_MODULE: hasPrisma ? '\n    PrismaModule,' : '',
  };

  const created: string[] = [];
  const kept: string[] = [];

  const writeIfMissing = (template: string, target: string): boolean => {
    const targetPath = path.join(serviceDir, target);
    if (fs.existsSync(targetPath)) {
      kept.push(target);
      return false;
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(
      targetPath,
      fillCronTemplate(
        fs.readFileSync(path.join(templateDir, template), 'utf-8'),
        values,
      ),
    );
    created.push(target);
    return true;
  };

  let moduleCreated = false;
  for (const { template, target } of CRON_SCAFFOLD_FILES) {
    const written = writeIfMissing(template, target);
    if (target === CRON_MODULE_FILE) {
      moduleCreated = written;
    }
  }

  const handlerFile = `${CRON_HANDLER_DIR}/${jobName}${CRON_HANDLER_SUFFIX}`;
  writeIfMissing(CRON_HANDLER_TEMPLATE, handlerFile);

  return { created, kept, moduleCreated, handlerFile, className };
}
