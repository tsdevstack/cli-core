/**
 * Recreate specific Docker containers by name
 */

import { execSync } from 'child_process';
import { logger } from '../../logger';

/**
 * Recreate specific containers by name
 * Uses --force-recreate to ensure bind-mounted config files are reloaded
 * If containers don't exist, they will be created
 *
 * @param containerNames - Array of container names to recreate
 * @param rootDir - Project root directory (for compose context)
 * @param wait - Whether to wait for containers to be healthy (default: true)
 * @param removeOrphans - Whether to remove orphaned containers (default: true for first container)
 */
export function recreateContainers(
  containerNames: string[],
  rootDir: string = process.cwd(),
  wait: boolean = true,
  removeOrphans: boolean = true
): void {
  for (let i = 0; i < containerNames.length; i++) {
    const containerName = containerNames[i];
    try {
      logger.creating(`Recreating ${containerName}...`);
      // Use up -d --force-recreate instead of restart to reload bind-mounted configs
      const waitFlag = wait ? '--wait' : '';
      // Only add --remove-orphans on first container to avoid duplicate cleanup warnings
      const orphansFlag = removeOrphans && i === 0 ? '--remove-orphans' : '';
      execSync(`docker compose up -d --force-recreate --no-deps ${waitFlag} ${orphansFlag} ${containerName}`, {
        cwd: rootDir,
        stdio: 'inherit',
      });
    } catch {
      logger.warn(`Failed to recreate ${containerName} (it may not exist in compose file)`);
    }
  }
}