import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';
import { CliError } from '../errors';

const { mockIsCIEnv, mockLogger, mockInquirerPrompt } = rs.hoisted(() => ({
  mockIsCIEnv: rs.fn(),
  mockLogger: {
    info: rs.fn(),
    newline: rs.fn(),
  },
  mockInquirerPrompt: rs.fn(),
}));

rs.mock('../ci', () => ({
  isCIEnv: mockIsCIEnv,
}));
rs.mock('../logger', () => ({
  logger: mockLogger,
}));
rs.mock('inquirer', () => ({
  default: {
    prompt: mockInquirerPrompt,
  },
}));

import { resolveEnvironment } from './resolve-environment';

describe('resolveEnvironment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    rs.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.TARGET_ENV;
    mockIsCIEnv.mockReturnValue(false);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Resolution via --env flag', () => {
    it('should return env from options when provided', async () => {
      const result = await resolveEnvironment(
        { env: 'dev' },
        ['dev', 'staging', 'prod'],
        'test-command',
      );

      expect(result).toBe('dev');
    });

    it('should throw when env flag is not in available envs (local mode)', async () => {
      await expect(
        resolveEnvironment(
          { env: 'invalid' },
          ['dev', 'staging'],
          'test-command',
        ),
      ).rejects.toThrow(CliError);
    });

    it('should allow any env flag value in CI mode', async () => {
      mockIsCIEnv.mockReturnValue(true);

      const result = await resolveEnvironment(
        { env: 'custom' },
        ['dev', 'staging'],
        'test-command',
      );

      expect(result).toBe('custom');
    });

    it('should allow env flag when available envs is empty', async () => {
      const result = await resolveEnvironment(
        { env: 'dev' },
        [],
        'test-command',
      );

      expect(result).toBe('dev');
    });
  });

  describe('Resolution via TARGET_ENV env var', () => {
    it('should use TARGET_ENV when no --env flag', async () => {
      process.env.TARGET_ENV = 'staging';

      const result = await resolveEnvironment(
        {},
        ['dev', 'staging', 'prod'],
        'test-command',
      );

      expect(result).toBe('staging');
    });

    it('should throw when TARGET_ENV not in available envs (local mode)', async () => {
      process.env.TARGET_ENV = 'invalid';

      await expect(
        resolveEnvironment({}, ['dev', 'staging'], 'test-command'),
      ).rejects.toThrow(CliError);
    });

    it('should allow any TARGET_ENV value in CI mode', async () => {
      mockIsCIEnv.mockReturnValue(true);
      process.env.TARGET_ENV = 'custom-env';

      const result = await resolveEnvironment(
        {},
        ['dev', 'staging'],
        'test-command',
      );

      expect(result).toBe('custom-env');
    });
  });

  describe('CI mode without env specified', () => {
    it('should throw CliError when no env specified in CI', async () => {
      mockIsCIEnv.mockReturnValue(true);

      await expect(
        resolveEnvironment({}, ['dev', 'staging'], 'deploy'),
      ).rejects.toThrow(CliError);
    });

    it('should include command name in error', async () => {
      mockIsCIEnv.mockReturnValue(true);

      try {
        await resolveEnvironment({}, ['dev'], 'my-command');
        expect.fail('Should have thrown');
      } catch (error) {
        const cliError = error as CliError;
        expect(cliError.context).toBe('my-command');
      }
    });
  });

  describe('Local mode auto-select', () => {
    it('should auto-select when only one environment available', async () => {
      const result = await resolveEnvironment({}, ['dev'], 'test-command');

      expect(result).toBe('dev');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('dev'),
      );
    });
  });

  describe('Local mode - no environments', () => {
    it('should throw CliError when no environments available', async () => {
      await expect(resolveEnvironment({}, [], 'test-command')).rejects.toThrow(
        CliError,
      );
    });

    it('should suggest cloud:init in error hint', async () => {
      try {
        await resolveEnvironment({}, [], 'test-command');
        expect.fail('Should have thrown');
      } catch (error) {
        const cliError = error as CliError;
        expect(cliError.hint).toContain('cloud:init');
      }
    });
  });

  describe('Local mode - prompt selection', () => {
    it('should prompt user when multiple environments available', async () => {
      mockInquirerPrompt.mockResolvedValue({ selectedEnv: 'staging' });

      const result = await resolveEnvironment(
        {},
        ['dev', 'staging', 'prod'],
        'test-command',
      );

      expect(result).toBe('staging');
      expect(mockInquirerPrompt).toHaveBeenCalled();
    });
  });
});
