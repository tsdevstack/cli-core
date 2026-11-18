import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import * as childProcess from 'child_process';

rs.mock('child_process', { mock: true });

import { runLocalPsql } from './run-local-psql';

function spawnResult(status: number, stderr = '') {
  return {
    status,
    stdout: '',
    stderr,
    pid: 1,
    output: [],
    signal: null,
  };
}

describe('runLocalPsql', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should pipe the SQL into psql in the compose container, stopping at the first error', () => {
      rs.mocked(childProcess.spawnSync).mockReturnValue(spawnResult(0));

      runLocalPsql(
        '/project',
        'auth-db',
        'auth-service',
        'postgres',
        'SELECT 1;',
      );

      expect(childProcess.spawnSync).toHaveBeenCalledWith(
        'docker',
        [
          'compose',
          'exec',
          '-T',
          'auth-db',
          'psql',
          '-X',
          '-q',
          '-v',
          'ON_ERROR_STOP=1',
          '-v',
          'VERBOSITY=terse',
          '-v',
          'SHOW_CONTEXT=never',
          '-U',
          'auth-service',
          '-d',
          'postgres',
        ],
        { cwd: '/project', input: 'SELECT 1;', encoding: 'utf-8' },
      );
    });
  });

  describe('Edge cases', () => {
    it("should throw a CliError with psql's message", () => {
      rs.mocked(childProcess.spawnSync).mockReturnValue(
        spawnResult(3, 'ERROR:  permission denied to create role'),
      );

      expect(() =>
        runLocalPsql(
          '/project',
          'auth-db',
          'auth-service',
          'auth-service',
          'x',
        ),
      ).toThrow(
        expect.objectContaining({
          name: 'CliError',
          message: 'Database setup failed in auth-db (auth-service)',
          hint: expect.stringContaining('permission denied to create role'),
        }),
      );
    });

    it('should never put the SQL (with passwords) in the error', () => {
      rs.mocked(childProcess.spawnSync).mockReturnValue(
        spawnResult(1, 'ERROR:  x'),
      );

      try {
        runLocalPsql(
          '/p',
          'auth-db',
          'u',
          'd',
          "SET tsdevstack.app_password = 'secret';",
        );
      } catch (error) {
        expect(JSON.stringify(error)).not.toContain('secret');
      }
    });
  });
});
