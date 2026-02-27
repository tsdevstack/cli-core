/**
 * Build FrameworkConfig from init options
 *
 * Creates the initial config.json structure based on user's template choice.
 */

import type { FrameworkConfig } from '../config/types';
import type { InitOptions } from './prompt-init-options';

export function buildConfig(options: InitOptions): FrameworkConfig {
  const template = options.template === 'empty' ? null : options.template;

  return {
    project: {
      name: options.projectName,
      version: '0.1.0',
    },
    framework: {
      template,
    },
    cloud: {
      provider: null,
    },
    services: [],
  };
}
