/**
 * Get service directory path
 *
 * @param serviceName - Name of the service
 * @param root - Project root directory (defaults to findProjectRoot())
 * @returns Absolute path to service directory
 */

import * as path from 'path';
import { findProjectRoot } from './find-project-root';
import { APPS_DIR } from '../../constants';

export function getServicePath(
  serviceName: string,
  root: string = findProjectRoot()
): string {
  return path.join(root, APPS_DIR, serviceName);
}