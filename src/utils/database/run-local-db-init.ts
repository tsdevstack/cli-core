/**
 * Set up the two database roles of each local service
 */

import { DB_INIT_MAINTENANCE_DATABASE } from '../../constants';
import { getDbServiceName } from '../docker/get-db-service-name';
import { logger } from '../logger';
import { loadServiceSecrets } from '../secrets';
import { buildDatabaseAppRole } from './build-database-app-role';
import { buildDbInitSettingsSql } from './build-db-init-settings-sql';
import { parsePostgresUrl } from './parse-postgres-url';
import { pickOwnerDatabaseUrl } from './pick-owner-database-url';
import { readDbInitSql } from './read-db-init-sql';
import { runLocalPsql } from './run-local-psql';

/**
 * Runs the db-init SQL in each service's Postgres container, the same SQL
 * the cloud db-init jobs run. It creates the app role with the password from
 * the service's DATABASE_URL and sets the rights. Locally the owner is the
 * container's own superuser (POSTGRES_USER, from MIGRATION_DATABASE_URL);
 * the SQL runs as it and leaves it as it is. Safe to run on every sync.
 *
 * A service whose DATABASE_URL is not its app role's (an override in
 * .secrets.user.json, for example a database elsewhere) is skipped.
 *
 * @param rootDir - Project root (where docker-compose.yml is)
 * @param serviceNames - Services with a database; their containers must be up
 */
export function runLocalDbInit(
  rootDir: string,
  serviceNames: readonly string[],
): void {
  const sql = readDbInitSql();

  for (const serviceName of serviceNames) {
    const secrets = loadServiceSecrets(serviceName);
    const ownerUrl = pickOwnerDatabaseUrl(secrets);
    const appUrl: unknown = secrets?.DATABASE_URL;
    if (!ownerUrl || typeof appUrl !== 'string') {
      logger.warn(
        `   Skipping ${serviceName}: no database URLs in the local secrets`,
      );
      continue;
    }

    const owner = parsePostgresUrl(ownerUrl);
    const app = parsePostgresUrl(appUrl);
    if (app.user !== buildDatabaseAppRole(serviceName)) {
      logger.warn(
        `   Skipping ${serviceName}: its DATABASE_URL doesn't use the app role ${buildDatabaseAppRole(serviceName)}`,
      );
      continue;
    }

    const settings = `${buildDbInitSettingsSql({
      owner: owner.user,
      app: app.user,
      database: owner.database,
      appPassword: app.password,
    })}\n`;
    const container = getDbServiceName(serviceName);

    runLocalPsql(
      rootDir,
      container,
      owner.user,
      DB_INIT_MAINTENANCE_DATABASE,
      settings + sql.server,
    );
    runLocalPsql(
      rootDir,
      container,
      owner.user,
      owner.database,
      settings + sql.database,
    );
    logger.success(`   ${serviceName}: ${owner.user} and ${app.user}`);
  }
}
