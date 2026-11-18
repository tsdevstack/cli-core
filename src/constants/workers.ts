/**
 * Detached workers: the files and scripts `register-detached-worker` adds to
 * the base service (the auth template's pattern)
 */

/** Folder of the worker file templates, under the CLI's templates */
export const WORKER_TEMPLATE_DIR = 'worker';

/** Each template and where it goes, relative to the base service's folder */
export const WORKER_SCAFFOLD_FILES = [
  { template: 'worker.ts.template', target: 'src/worker.ts' },
  { template: 'worker.module.ts.template', target: 'src/worker.module.ts' },
  { template: 'tsconfig.worker.json.template', target: 'tsconfig.worker.json' },
] as const;

/**
 * The base service's worker scripts: `npm run dev` starts every
 * `start-worker:dev`; deployments run `dist/worker.js`
 */
export const WORKER_SCRIPTS = {
  'start-worker:dev':
    'nest start --entryFile worker --watch --path tsconfig.worker.json',
  'start-worker': 'node dist/worker.js',
} as const;
