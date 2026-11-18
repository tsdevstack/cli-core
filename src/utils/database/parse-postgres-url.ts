/**
 * Split a postgresql:// URL into its parts
 */

import { CliError } from '../errors';
import type { PostgresUrlParts } from './types';

/**
 * @param url - postgresql:// or postgres:// URL with user, password and database
 * @returns Its parts, the password decoded
 * @throws CliError when the URL lacks one of them (the message never contains the URL)
 */
export function parsePostgresUrl(url: string): PostgresUrlParts {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new CliError(
      'Invalid database URL',
      'Database URL',
      'Expected postgresql://user:password@host:port/database',
    );
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (
    (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') ||
    !parsed.username ||
    !parsed.password ||
    !database
  ) {
    throw new CliError(
      'Invalid database URL',
      'Database URL',
      'Expected postgresql://user:password@host:port/database',
    );
  }

  return {
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database,
  };
}
