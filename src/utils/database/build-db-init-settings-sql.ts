/**
 * Build the SET statements the db-init SQL reads
 */

import { quotePgLiteral } from './quote-pg-literal';
import type { DbInitSettings } from './types';

/**
 * The tsdevstack.* settings for one service, as SET statements to run before
 * the db-init SQL in the same session (psql). A password left out is set
 * empty, which the SQL reads as "leave it".
 *
 * @param settings - Roles, database and the passwords to set
 * @returns SET statements, one per line
 */
export function buildDbInitSettingsSql(settings: DbInitSettings): string {
  const values: Array<[string, string]> = [
    ['owner', settings.owner],
    ['app', settings.app],
    ['database', settings.database],
    ['owner_password', settings.ownerPassword ?? ''],
    ['app_password', settings.appPassword ?? ''],
  ];

  return values
    .map(
      ([name, value]) => `SET tsdevstack.${name} = ${quotePgLiteral(value)};`,
    )
    .join('\n');
}
