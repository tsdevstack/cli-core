import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { resolve } from 'path';
import { findProjectRoot } from './find-project-root';
import { CliError } from '../errors';
import { TSDEVSTACK_DIR } from '../../constants';

// Mock dependencies
rs.mock('../fs', () => ({
  isDirectory: rs.fn(),
}));

import { isDirectory } from '../fs';

describe('findProjectRoot', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should find .tsdevstack in current directory', () => {
    const startDir = '/projects/my-app';
    rs.mocked(isDirectory).mockImplementation((dir: string) => {
      return dir === `/projects/my-app/${TSDEVSTACK_DIR}`;
    });

    const result = findProjectRoot(startDir);

    expect(result).toBe('/projects/my-app');
    expect(isDirectory).toHaveBeenCalledWith(
      `/projects/my-app/${TSDEVSTACK_DIR}`,
    );
  });

  it('should find .tsdevstack in parent directory', () => {
    const startDir = '/projects/my-app/apps/user-service';
    rs.mocked(isDirectory).mockImplementation((dir: string) => {
      return dir === `/projects/my-app/${TSDEVSTACK_DIR}`;
    });

    const result = findProjectRoot(startDir);

    expect(result).toBe('/projects/my-app');
    expect(isDirectory).toHaveBeenCalledWith(
      `/projects/my-app/apps/user-service/${TSDEVSTACK_DIR}`,
    );
    expect(isDirectory).toHaveBeenCalledWith(
      `/projects/my-app/apps/${TSDEVSTACK_DIR}`,
    );
    expect(isDirectory).toHaveBeenCalledWith(
      `/projects/my-app/${TSDEVSTACK_DIR}`,
    );
  });

  it('should find .tsdevstack multiple levels up', () => {
    const startDir = '/projects/my-app/apps/user-service/src/controllers';
    rs.mocked(isDirectory).mockImplementation((dir: string) => {
      return dir === `/projects/my-app/${TSDEVSTACK_DIR}`;
    });

    const result = findProjectRoot(startDir);

    expect(result).toBe('/projects/my-app');
  });

  it('should respect maxDepth parameter', () => {
    const startDir = '/projects/my-app/apps/user-service/src/controllers';
    rs.mocked(isDirectory).mockReturnValue(false);

    expect(() => {
      findProjectRoot(startDir, 2);
    }).toThrow(CliError);

    // Should only check startDir + 2 parent directories
    expect(isDirectory).toHaveBeenCalledTimes(2);
  });

  it('should throw CliError when .tsdevstack not found', () => {
    const startDir = '/projects/my-app';
    rs.mocked(isDirectory).mockReturnValue(false);

    expect(() => {
      findProjectRoot(startDir);
    }).toThrow(CliError);
  });

  it('should include helpful error message with search path and depth', () => {
    const startDir = '/projects/my-app';
    rs.mocked(isDirectory).mockReturnValue(false);

    try {
      findProjectRoot(startDir, 5);
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toContain('/projects/my-app');
      expect(cliError.message).toContain(TSDEVSTACK_DIR);
      expect(cliError.context).toBe('Could not find tsdevstack project root');
      expect(cliError.hint).toContain(
        'run this command from within your tsdevstack project',
      );
    }
  });

  it('should stop at filesystem root', () => {
    const startDir = '/some/deep/path';
    rs.mocked(isDirectory).mockReturnValue(false);

    // Mock to simulate reaching filesystem root
    // path.dirname('/') returns '/', so it will stop
    try {
      findProjectRoot(startDir);
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.context).toBe('Could not find tsdevstack project root');
    }
  });

  it('should use process.cwd() as default startDir', () => {
    rs.spyOn(process, 'cwd').mockReturnValue(
      '/projects/my-app/apps/user-service',
    );

    rs.mocked(isDirectory).mockImplementation((dir: string) => {
      return dir === `/projects/my-app/${TSDEVSTACK_DIR}`;
    });

    const result = findProjectRoot();

    expect(result).toBe('/projects/my-app');
    expect(process.cwd).toHaveBeenCalled();

    rs.mocked(process.cwd).mockRestore();
  });

  it('should use default maxDepth of 10', () => {
    const startDir = '/a/b/c/d/e/f/g/h/i/j/k';
    rs.mocked(isDirectory).mockReturnValue(false);

    try {
      findProjectRoot(startDir);
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toContain('10');
    }
  });

  it('should resolve relative startDir to absolute path', () => {
    const startDir = './relative/path';
    rs.mocked(isDirectory).mockImplementation((dir: string) => {
      // Check that paths being tested are absolute
      return dir.startsWith('/') && dir.includes(TSDEVSTACK_DIR);
    });

    // Should not throw, even though we're passing relative path
    // path.resolve will convert it to absolute
    const absoluteStart = resolve(startDir);
    rs.mocked(isDirectory).mockImplementation((dir: string) => {
      return dir === `${absoluteStart}/${TSDEVSTACK_DIR}`;
    });

    const result = findProjectRoot(startDir);
    expect(result).toBe(absoluteStart);
  });
});
