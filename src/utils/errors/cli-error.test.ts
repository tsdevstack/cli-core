import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('../logger', () => ({
  logger: {
    error: rs.fn(),
  },
}));

import { CliError } from './cli-error';
import { logger } from '../logger';

describe('CliError', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('constructor', () => {
    it('should set message and name', () => {
      const error = new CliError('something failed');
      expect(error.message).toBe('something failed');
      expect(error.name).toBe('CliError');
    });

    it('should set context and hint', () => {
      const error = new CliError('msg', 'Deploy', 'Try again');
      expect(error.context).toBe('Deploy');
      expect(error.hint).toBe('Try again');
    });

    it('should be an instance of Error', () => {
      const error = new CliError('msg');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('format', () => {
    it('should format message only', () => {
      const error = new CliError('something failed');
      expect(error.format()).toBe('something failed');
    });

    it('should format with context', () => {
      const error = new CliError('something failed', 'Deploy');
      expect(error.format()).toBe('Deploy:\n\nsomething failed');
    });

    it('should format with context and hint', () => {
      const error = new CliError('something failed', 'Deploy', 'Try again');
      expect(error.format()).toBe('Deploy:\n\nsomething failed\n\nTry again');
    });

    it('should format with hint but no context', () => {
      const error = new CliError('something failed', undefined, 'Try again');
      expect(error.format()).toBe('something failed\n\nTry again');
    });
  });

  describe('logAndExit', () => {
    it('should log formatted error and exit with code 1 by default', () => {
      const mockExit = rs.fn<(code?: number) => never>();
      const originalExit = process.exit;
      process.exit = mockExit as unknown as typeof process.exit;

      try {
        const error = new CliError('fail', 'Context');
        error.logAndExit();
      } catch {
        // process.exit mock doesn't actually exit
      }

      expect(rs.mocked(logger.error)).toHaveBeenCalledWith('Context:\n\nfail');
      expect(mockExit).toHaveBeenCalledWith(1);

      process.exit = originalExit;
    });

    it('should use custom exit code', () => {
      const mockExit = rs.fn<(code?: number) => never>();
      const originalExit = process.exit;
      process.exit = mockExit as unknown as typeof process.exit;

      try {
        const error = new CliError('fail');
        error.logAndExit(2);
      } catch {
        // process.exit mock doesn't actually exit
      }

      expect(mockExit).toHaveBeenCalledWith(2);

      process.exit = originalExit;
    });
  });
});
