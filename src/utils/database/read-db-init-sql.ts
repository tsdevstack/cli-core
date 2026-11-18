/**
 * Read the db-init SQL shipped with the CLI
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  DB_INIT_DATABASE_SQL_FILE,
  DB_INIT_SERVER_SQL_FILE,
  DB_INIT_TEMPLATE_DIR,
} from '../../constants';
import { resolveCliAssetDir } from '../paths/resolve-cli-asset-dir';
import type { DbInitSql } from './types';

/**
 * The two parts of the db-init SQL (templates/db-init), the one source for
 * the local setup and every cloud's db-init job.
 *
 * @returns The server part and the database part
 */
export function readDbInitSql(): DbInitSql {
  const dir = resolveCliAssetDir(DB_INIT_TEMPLATE_DIR);
  return {
    server: fs.readFileSync(path.join(dir, DB_INIT_SERVER_SQL_FILE), 'utf-8'),
    database: fs.readFileSync(
      path.join(dir, DB_INIT_DATABASE_SQL_FILE),
      'utf-8',
    ),
  };
}
