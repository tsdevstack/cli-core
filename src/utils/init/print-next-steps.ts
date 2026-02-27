/**
 * Print next steps after project initialization
 *
 * Outputs a numbered list of what the user should do after init completes.
 */

import { logger } from '../logger';
import type { InitOptions } from './prompt-init-options';

export function printNextSteps(options: InitOptions): void {
  logger.newline();
  logger.complete(`Project "${options.projectName}" created successfully!`);
  logger.newline();
  logger.info('Next steps:');
  logger.info(`  1. cd ${options.projectName}`);

  let step = 2;

  if (options.template === 'empty') {
    logger.info(`  ${step}. npx tsdevstack add-service`);
    step++;
  }

  logger.info(
    `  ${step}. npx tsdevstack cloud:init --gcp|--aws|--azure  (when ready)`,
  );
  step++;

  logger.info(`  ${step}. docker compose up -d`);
  step++;
  logger.info(`  ${step}. npm run dev`);
  logger.newline();
}
