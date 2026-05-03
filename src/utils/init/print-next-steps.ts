/**
 * Print next steps after project initialization
 *
 * Outputs a numbered list of what the user should do after init completes.
 * If any steps failed, prints an issues summary instead of the success banner
 * and points the user at the recovery command.
 */

import { logger } from '../logger';
import type { InitOptions } from './prompt-init-options';

export interface StepFailure {
  name: string;
  hint?: string;
}

export function printNextSteps(
  options: InitOptions,
  failures: StepFailure[] = [],
): void {
  logger.newline();

  if (failures.length > 0) {
    logger.warn(`Project "${options.projectName}" created with issues:`);
    logger.newline();
    for (const failure of failures) {
      logger.warn(`  ❌ ${failure.name}`);
      if (failure.hint) {
        logger.info(`     ${failure.hint}`);
      }
    }
    logger.newline();
    logger.info('To recover:');
    logger.info(`  1. cd ${options.projectName}`);
    logger.info('  2. Resolve the issues above');
    logger.info('  3. npx tsdevstack sync');
    logger.newline();
    return;
  }

  logger.complete(`Project "${options.projectName}" created successfully!`);
  logger.newline();
  logger.info('Next steps:');
  logger.info(`  1. cd ${options.projectName}`);

  let step = 2;

  if (options.template === 'empty') {
    logger.info(`  ${step}. npx tsdevstack add-service`);
    step++;
  }

  logger.info(`  ${step}. npx tsdevstack sync`);
  step++;
  logger.info(`  ${step}. npm run dev`);
  step++;
  logger.info(
    `  ${step}. npx tsdevstack cloud:init --gcp|--aws|--azure  (when ready)`,
  );
  logger.newline();
}
