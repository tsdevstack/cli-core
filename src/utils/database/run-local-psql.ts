/**
 * Run SQL in a local Postgres container
 */

import { spawnSync } from 'child_process';
import { CliError } from '../errors';

/**
 * Pipes SQL into psql inside a docker-compose Postgres container, over its
 * Unix socket (trusted inside the container). Stops at the first error.
 * Errors print without the failing statement (VERBOSITY terse), so a
 * password in it never reaches the terminal.
 *
 * @param rootDir - Project root (where docker-compose.yml is)
 * @param container - Compose service of the database (e.g., "auth-db")
 * @param user - Role to run as
 * @param database - Database to run in
 * @param sql - Statements to run
 * @throws CliError when psql fails
 */
export function runLocalPsql(
  rootDir: string,
  container: string,
  user: string,
  database: string,
  sql: string,
): void {
  const result = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      container,
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
      user,
      '-d',
      database,
    ],
    { cwd: rootDir, input: sql, encoding: 'utf-8' },
  );

  if (result.status !== 0) {
    throw new CliError(
      `Database setup failed in ${container} (${database})`,
      'Local database users',
      `${(result.stderr || result.error?.message || '').trim()}\nIs the container running? Try: docker compose up -d ${container}`,
    );
  }
}
