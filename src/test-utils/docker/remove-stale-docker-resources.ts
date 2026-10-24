/**
 * Remove Stale Docker Resources
 *
 * A Docker test run killed before afterAll leaves its containers (still
 * running), network and image behind. Called at the start of a run, this
 * removes the resources named by buildDockerTestPrefix(base) whose run is
 * gone, and leaves those of runs still in progress alone. Best effort:
 * failures are ignored, like the cleanup in afterAll.
 */

import { spawnSync } from 'child_process';
import { isStaleDockerTestResource } from './is-stale-docker-test-resource';

export function removeStaleDockerResources(base: string): void {
  const staleNames = (listArgs: string[]): string[] => {
    const result = spawnSync('docker', listArgs, { encoding: 'utf-8' });
    if (result.status !== 0) {
      return [];
    }
    return result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((name) => isStaleDockerTestResource(name, base));
  };

  const remove = (removeArgs: string[], names: string[]): void => {
    if (names.length > 0) {
      spawnSync('docker', [...removeArgs, ...names], { stdio: 'ignore' });
    }
  };

  // Containers first: a network in use cannot be removed
  remove(
    ['rm', '-f'],
    staleNames([
      'ps',
      '-a',
      '--filter',
      `name=${base}-`,
      '--format',
      '{{.Names}}',
    ]),
  );
  remove(
    ['network', 'rm'],
    staleNames([
      'network',
      'ls',
      '--filter',
      `name=${base}-`,
      '--format',
      '{{.Name}}',
    ]),
  );
  remove(
    ['rmi', '-f'],
    staleNames([
      'images',
      '--filter',
      `reference=${base}-*`,
      '--format',
      '{{.Repository}}',
    ]),
  );
}
