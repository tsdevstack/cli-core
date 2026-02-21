/**
 * Stop and remove a specific Docker container
 */

import { execSync } from 'child_process';

/**
 * Stop and remove a specific container
 *
 * Handles containers in any state (Created, Running, Paused, Exited).
 * Uses `docker rm -f` which both stops and removes in one command.
 *
 * @param containerName - Full container name (e.g., "project-auth-db-1")
 * @returns true if container was removed, false if it didn't exist
 */
export function stopAndRemoveContainer(containerName: string): boolean {
  try {
    // Use -f to force removal (handles containers in Created/Running/Paused state)
    execSync(`docker rm -f ${containerName}`, { stdio: 'ignore' });
    return true;
  } catch {
    // Container doesn't exist
    return false;
  }
}