import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';

rs.mock('../logger', () => ({
  logger: {
    error: rs.fn(),
    warn: rs.fn(),
    debug: rs.fn(),
  },
}));

import { wrapCommand } from './wrap-command';
import { CliError } from './cli-error';
import { logger } from '../logger';

describe('wrapCommand', () => {
  const originalExit = process.exit;

  beforeEach(() => {
    rs.clearAllMocks();
    process.exit = rs.fn() as never;
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  describe('Standard use cases', () => {
    it('should call the wrapped function with no arguments', async () => {
      const fn = rs.fn<() => Promise<void>>().mockResolvedValue(undefined);
      const wrapped = wrapCommand(fn);

      await wrapped();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call the wrapped function with arguments', async () => {
      const fn = rs
        .fn<(a: string, b: number) => Promise<void>>()
        .mockResolvedValue(undefined);
      const wrapped = wrapCommand(fn);

      await wrapped('hello', 42);

      expect(fn).toHaveBeenCalledWith('hello', 42);
    });

    it('should not catch errors when command succeeds', async () => {
      const fn = rs.fn<() => Promise<void>>().mockResolvedValue(undefined);
      const wrapped = wrapCommand(fn);

      await wrapped();

      expect(logger.error).not.toHaveBeenCalled();
      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  describe('CliError handling', () => {
    it('should call logAndExit for CliError instances', async () => {
      const cliError = new CliError('test error', 'context', 'hint');
      const logAndExitSpy = rs.fn<(code?: number) => never>();
      cliError.logAndExit = logAndExitSpy;

      const fn = rs.fn<() => Promise<void>>().mockRejectedValue(cliError);
      const wrapped = wrapCommand(fn);

      await wrapped();

      expect(logAndExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Unknown error handling', () => {
    it('should log message and exit for regular Error', async () => {
      const error = new Error('unexpected failure');
      const fn = rs.fn<() => Promise<void>>().mockRejectedValue(error);
      const wrapped = wrapCommand(fn);

      await wrapped();

      expect(logger.error).toHaveBeenCalledWith('Unexpected error occurred:');
      expect(logger.error).toHaveBeenCalledWith('unexpected failure');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should log stack trace for regular Error', async () => {
      const error = new Error('with stack');
      const fn = rs.fn<() => Promise<void>>().mockRejectedValue(error);
      const wrapped = wrapCommand(fn);

      await wrapped();

      expect(logger.debug).toHaveBeenCalled();
    });

    it('should handle non-Error thrown values', async () => {
      const fn = rs.fn<() => Promise<void>>().mockRejectedValue('string error');
      const wrapped = wrapCommand(fn);

      await wrapped();

      expect(logger.error).toHaveBeenCalledWith('Unexpected error occurred:');
      expect(logger.error).toHaveBeenCalledWith('string error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should log hint from structured errors', async () => {
      const error = Object.assign(new Error('msg'), { hint: 'try this' });
      const fn = rs.fn<() => Promise<void>>().mockRejectedValue(error);
      const wrapped = wrapCommand(fn);

      await wrapped();

      expect(logger.error).toHaveBeenCalledWith('try this');
    });
  });

  describe('Closed prompt handling', () => {
    const originalIsTTY = process.stdin.isTTY;

    const promptClosedError = (): Error => {
      const error = new Error('User force closed the prompt with 0 null');
      error.name = 'ExitPromptError';
      return error;
    };

    afterEach(() => {
      process.stdin.isTTY = originalIsTTY;
    });

    it('should explain the missing terminal when stdin is not interactive', async () => {
      process.stdin.isTTY = false;
      const fn = rs
        .fn<() => Promise<void>>()
        .mockRejectedValue(promptClosedError());

      await wrapCommand(fn)();

      expect(logger.error).toHaveBeenCalledWith(
        'This command asked a question, but no terminal is attached to answer it.',
      );
      expect(logger.error).not.toHaveBeenCalledWith(
        'Unexpected error occurred:',
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should report a cancel (Ctrl+C) in a terminal', async () => {
      process.stdin.isTTY = true;
      const fn = rs
        .fn<() => Promise<void>>()
        .mockRejectedValue(promptClosedError());

      await wrapCommand(fn)();

      expect(logger.warn).toHaveBeenCalledWith('Cancelled');
      expect(logger.error).not.toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(130);
    });
  });
});
