/**
 * Check if framework has an auth template configured.
 */

import type { FrameworkConfig } from './types';

/**
 * Returns true for 'fullstack-auth' or 'auth', false for null/undefined.
 */
export function hasAuthTemplate(config: FrameworkConfig): boolean {
  const template = config.framework?.template;
  return template === 'fullstack-auth' || template === 'auth';
}