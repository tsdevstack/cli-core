/**
 * Get client package directory path
 *
 * @param serviceName - Name of the service (e.g., "auth-service")
 * @param root - Project root directory (defaults to findProjectRoot())
 * @returns Absolute path to client package directory (e.g., packages/auth-service-client)
 */

import * as path from 'path';
import { findProjectRoot } from './find-project-root';
import { PACKAGES_DIR } from '../../constants';

export function getClientPath(
  serviceName: string,
  root: string = findProjectRoot()
): string {
  const clientName = `${serviceName}-client`;
  return path.join(root, PACKAGES_DIR, clientName);
}
