/**
 * Get service package.json path
 *
 * @param serviceName - Name of the service
 * @param root - Project root directory (defaults to findProjectRoot())
 * @returns Absolute path to service package.json
 */

import * as path from 'path';
import { findProjectRoot } from './find-project-root';
import { getServicePath } from './get-service-path';

export function getServicePackageJsonPath(
  serviceName: string,
  root: string = findProjectRoot()
): string {
  return path.join(getServicePath(serviceName, root), 'package.json');
}