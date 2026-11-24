/**
 * Cron jobs: the files and the script `register-cron` adds to a NestJS
 * service, and the infrastructure.json entry it prints. A cron job is the
 * service's own image run as `node dist/cron.js <name>` on a schedule.
 */

/** Folder of the cron file templates, under the CLI's templates */
export const CRON_TEMPLATE_DIR = 'cron';

/** The entrypoint: `node dist/cron.js <name>` */
export const CRON_ENTRY_FILE = 'src/cron.ts';

/** The module that lists the service's handlers */
export const CRON_MODULE_FILE = 'src/cron.module.ts';

/** The tsconfig of local runs (own output folder, see CRON_SCRIPTS) */
export const CRON_TSCONFIG_FILE = 'tsconfig.cron.json';

/**
 * The shared files, created once per service, relative to the service's
 * folder. The module template lists the first handler.
 */
export const CRON_SCAFFOLD_FILES = [
  { template: 'cron.ts.template', target: CRON_ENTRY_FILE },
  { template: 'cron.module.ts.template', target: CRON_MODULE_FILE },
  { template: 'tsconfig.cron.json.template', target: CRON_TSCONFIG_FILE },
] as const;

/** The handler template, one file per cron job */
export const CRON_HANDLER_TEMPLATE = 'cron-handler.ts.template';

/** Where a service's handlers live, relative to the service's folder */
export const CRON_HANDLER_DIR = 'src/cron';

/** A handler file is `{name}.cron.ts` */
export const CRON_HANDLER_SUFFIX = '.cron.ts';

/** The service's Prisma module; the cron module imports it when the file exists */
export const PRISMA_MODULE_FILE = 'src/prisma/prisma.module.ts';

/**
 * The service's cron script: `npm run cron -- <name>` runs one handler
 * against the local stack. It compiles into its own folder (tsconfig.cron.json)
 * so it doesn't fight a running `npm run dev`; deployments run `dist/cron.js`.
 */
export const CRON_SCRIPTS = {
  cron: 'nest start --entryFile cron --path tsconfig.cron.json --',
} as const;

/**
 * A cron job's name: kebab-case (lowercase letters, digits, single hyphens,
 * starting with a letter, ending with a letter or digit), at most 40
 * characters. It names the handler file, its class and the cloud job
 * resources. The same rule as infra-core's (a test keeps the two equal).
 */
export const CRON_JOB_NAME_PATTERN = /^[a-z][a-z0-9-]*[a-z0-9]$/;
export const CRON_JOB_NAME_MAX_LENGTH = 40;

/** `type` of a cron job entry in infrastructure.json (a trigger has none) */
export const CRON_JOB_TYPE = 'cron';

/** `timeout` (seconds) of a cron job entry when not set */
export const DEFAULT_CRON_JOB_TIMEOUT_SECONDS = 600;

/**
 * Exit code of a run that never started: no name, an unknown name (the
 * handler isn't listed in cron.module.ts), a wiring error. The same value
 * as nest-common's CRON_EXIT_UNKNOWN_JOB.
 */
export const CRON_EXIT_NOT_STARTED = 2;

/** The schedule in the printed entry: every day at 03:00 */
export const EXAMPLE_CRON_SCHEDULE = '0 3 * * *';

/** How long `run-cron` waits for a trigger's local endpoint when the entry sets no httpTimeout (seconds) */
export const DEFAULT_TRIGGER_RUN_TIMEOUT_SECONDS = 120;
