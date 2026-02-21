/**
 * Get client package src directory path
 *
 * @param clientName - Name of the client package
 * @param root - Project root directory (defaults to findProjectRoot())
 * @returns Absolute path to client src directory
 */

import * as path from 'path';
import { findProjectRoot } from './find-project-root';
import { PACKAGES_DIR } from '../../constants';

export function getClientSrcPath(
  clientName: string,
  root: string = findProjectRoot()
): string {
  return path.join(root, PACKAGES_DIR, clientName, 'src');
}