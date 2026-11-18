/**
 * Database users constants
 *
 * Every service with a database has two Postgres roles: the owner
 * ({service}), which owns the tables and is used only by migrations, and the
 * app role ({service}_app), which the running service uses to read and
 * write rows. db-init creates them and sets their rights, locally and in
 * every cloud, from the SQL in templates/db-init.
 */

/** Suffix of a service's app role: `auth-service` → `auth-service_app` */
export const DATABASE_APP_ROLE_SUFFIX = '_app';

/**
 * Service secret with the owner role's URL. Only migrations and Prisma's
 * tools use it (under the name DATABASE_URL); DATABASE_URL holds the app
 * role's URL.
 */
export const MIGRATION_DATABASE_URL_KEY = 'MIGRATION_DATABASE_URL';

/** db-init SQL folder, relative to the CLI templates directory */
export const DB_INIT_TEMPLATE_DIR = 'db-init';

/** db-init's server part: roles, passwords, who connects to the database */
export const DB_INIT_SERVER_SQL_FILE = 'server.sql';

/** db-init's database part: object ownership and the app role's rights */
export const DB_INIT_DATABASE_SQL_FILE = 'database.sql';

/** Database the server part runs in */
export const DB_INIT_MAINTENANCE_DATABASE = 'postgres';
