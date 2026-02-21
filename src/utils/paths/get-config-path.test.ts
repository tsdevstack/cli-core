import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { getConfigPath } from './get-config-path';
import { TSDEVSTACK_DIR, CONFIG_FILENAME } from '../../constants';

// Mock dependencies
rs.mock('./find-project-root', () => ({
  findProjectRoot: rs.fn(),
}));

import { findProjectRoot } from './find-project-root';

describe('getConfigPath', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should construct path with custom root using TSDEVSTACK_DIR and CONFIG_FILENAME constants', () => {
    const testRoot = '/projects/my-app';

    const result = getConfigPath(testRoot);

    expect(result).toBe(
      `/projects/my-app/${TSDEVSTACK_DIR}/${CONFIG_FILENAME}`,
    );
    expect(findProjectRoot).not.toHaveBeenCalled();
  });

  it('should use findProjectRoot() when root not provided', () => {
    rs.mocked(findProjectRoot).mockReturnValue('/projects/detected-root');

    const result = getConfigPath();

    expect(result).toBe(
      `/projects/detected-root/${TSDEVSTACK_DIR}/${CONFIG_FILENAME}`,
    );
    expect(findProjectRoot).toHaveBeenCalledOnce();
  });

  it('should return absolute path', () => {
    const result = getConfigPath('/root');
    expect(result.startsWith('/')).toBe(true);
  });

  it('should always return path to config.json', () => {
    const testRoots = ['/project1', '/another/project', '/tmp/test'];

    testRoots.forEach((root) => {
      const result = getConfigPath(root);
      expect(result).toContain(CONFIG_FILENAME);
      expect(result).toContain(TSDEVSTACK_DIR);
    });
  });
});
