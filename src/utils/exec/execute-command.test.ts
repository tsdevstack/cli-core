import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';

const { mockExecSync } = rs.hoisted(() => ({
  mockExecSync: rs.fn(),
}));

rs.mock('child_process', () => ({
  execSync: mockExecSync,
}));
rs.mock('../logger', () => ({
  logger: {
    running: rs.fn(),
    info: rs.fn(),
    newline: rs.fn(),
    error: rs.fn(),
  },
}));

import { executeCommand } from './execute-command';
import { logger } from '../logger';

describe('executeCommand', () => {
  const originalExit = process.exit;

  beforeEach(() => {
    rs.clearAllMocks();
    process.exit = rs.fn() as never;
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  describe('Standard use cases', () => {
    it('should execute command with default options', () => {
      executeCommand('npm install');

      expect(mockExecSync).toHaveBeenCalledWith('npm install', {
        stdio: 'inherit',
        cwd: undefined,
        encoding: 'utf-8',
        env: process.env,
      });
    });

    it('should log command before execution by default', () => {
      executeCommand('npm install');

      expect(logger.running).toHaveBeenCalledWith('Running: npm install');
      expect(logger.newline).toHaveBeenCalled();
    });

    it('should log working directory when cwd is provided', () => {
      executeCommand('npm install', { cwd: '/some/dir' });

      expect(logger.info).toHaveBeenCalledWith(
        '   Working directory: /some/dir',
      );
    });

    it('should not log when logCommand is false', () => {
      executeCommand('npm install', { logCommand: false });

      expect(logger.running).not.toHaveBeenCalled();
    });

    it('should return output when stdio is pipe', () => {
      mockExecSync.mockReturnValue('command output');

      const result = executeCommand('echo hello', { stdio: 'pipe' });

      expect(result).toBe('command output');
    });

    it('should return undefined when stdio is inherit', () => {
      const result = executeCommand('npm install', { stdio: 'inherit' });

      expect(result).toBeUndefined();
    });

    it('should merge custom env with process.env', () => {
      const customEnv = { MY_VAR: 'value' };

      executeCommand('some-command', { env: customEnv });

      expect(mockExecSync).toHaveBeenCalledWith('some-command', {
        stdio: 'inherit',
        cwd: undefined,
        encoding: 'utf-8',
        env: { ...process.env, MY_VAR: 'value' },
      });
    });
  });

  describe('Error handling', () => {
    it('should exit process on error when exitOnError is true', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('command failed');
      });

      executeCommand('bad-command');

      expect(logger.error).toHaveBeenCalledWith(
        'Error executing command: bad-command',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should throw error when exitOnError is false', () => {
      const error = new Error('command failed');
      mockExecSync.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        executeCommand('bad-command', { exitOnError: false });
      }).toThrow('command failed');
    });

    it('should log error message for Error instances', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('specific error');
      });

      executeCommand('bad-command');

      expect(logger.error).toHaveBeenCalledWith('specific error');
    });
  });
});
