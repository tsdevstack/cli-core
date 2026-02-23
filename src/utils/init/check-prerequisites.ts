/**
 * Check prerequisites for project initialization
 *
 * Validates that required tools are installed before scaffolding.
 * Returns errors (blockers) and warnings (non-blocking).
 *
 * @returns PrerequisiteResult with errors and warnings arrays
 */

import { spawnSync } from 'child_process';

export interface PrerequisiteResult {
  errors: string[];
  warnings: string[];
}

/**
 * Check if a command is available on the system
 */
function isCommandAvailable(command: string): boolean {
  const result = spawnSync('which', [command], { stdio: 'pipe' });
  return result.status === 0;
}

export function checkPrerequisites(): PrerequisiteResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Node >= 20 (error)
  const nodeMajor = parseInt(process.version.slice(1), 10);
  if (nodeMajor < 20) {
    errors.push(`Node.js >= 20 is required (found ${process.version})`);
  }

  // git installed (error)
  if (!isCommandAvailable('git')) {
    errors.push('git is required but not installed');
  }

  // Docker installed (warning)
  if (!isCommandAvailable('docker')) {
    warnings.push('Docker not found — needed for local development');
  }

  // Terraform installed (warning)
  if (!isCommandAvailable('terraform')) {
    warnings.push('Terraform not found — needed for cloud deployment');
  }

  return { errors, warnings };
}
