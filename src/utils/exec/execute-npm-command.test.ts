import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('./execute-command', () => ({
  executeCommand: rs.fn(),
}));

import { executeNpmCommand } from './execute-npm-command';
import { executeCommand } from './execute-command';

describe('executeNpmCommand', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should execute npm run with the given script', () => {
      executeNpmCommand('build', '/path/to/package');

      expect(executeCommand).toHaveBeenCalledWith('npm run build', {
        cwd: '/path/to/package',
      });
    });

    it('should pass additional options to executeCommand', () => {
      executeNpmCommand('test', '/path/to/package', {
        exitOnError: false,
        stdio: 'pipe',
      });

      expect(executeCommand).toHaveBeenCalledWith('npm run test', {
        exitOnError: false,
        stdio: 'pipe',
        cwd: '/path/to/package',
      });
    });

    it('should return the result from executeCommand', () => {
      rs.mocked(executeCommand).mockReturnValue('test output');

      const result = executeNpmCommand('test', '/path', { stdio: 'pipe' });

      expect(result).toBe('test output');
    });
  });

  describe('Edge cases', () => {
    it('should override cwd in options with the cwd parameter', () => {
      executeNpmCommand('build', '/correct/path');

      const callArgs = rs.mocked(executeCommand).mock.calls[0];
      expect(callArgs[1]).toEqual({ cwd: '/correct/path' });
    });
  });
});
