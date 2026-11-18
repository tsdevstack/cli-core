/**
 * Docker-backed test of the db-init SQL (templates/db-init) on real
 * Postgres, in the situations it meets:
 *
 * - GCP (Postgres 15): Cloud SQL's admin is a non-superuser member of
 *   cloudsqlsuperuser (CREATEROLE, CREATEDB); the owner role exists (Terraform
 *   made it) and Cloud SQL made it a cloudsqlsuperuser member.
 * - AWS (Postgres 15): the admin is a non-superuser with CREATEROLE and
 *   CREATEDB (rds_superuser); the owner role and the database exist the way
 *   the old db-init made them.
 * - Azure (Postgres 16): the admin is a non-superuser with CREATEROLE and
 *   CREATEDB (azure_pg_admin); no owner role yet, and the tables, an enum, a
 *   sequence, a function and a view belong to the admin (the migrations ran
 *   as it).
 * - Local (Postgres 16): the owner is the container's own superuser
 *   (POSTGRES_USER), the way the generated docker-compose.yml starts it.
 *
 * The SQL runs twice everywhere (it must be safe to run again). Checks log in
 * over TCP with passwords, as the services do.
 *
 * Containers run as attached child processes (`docker run --rm`, no -d) and
 * are removed in afterAll. Skipped with a message when Docker is not
 * available. Every resource is named `tsds-dbinit-e2e-<pid>-<random>-*`; a
 * run killed before afterAll leaves them behind, the next run removes them.
 * By hand:
 *   docker ps -a --filter name=tsds-dbinit-e2e- -q | xargs docker rm -f
 */

import { describe, it, expect, beforeAll, afterAll } from '@rstest/core';
import { spawnSync } from 'child_process';
import {
  buildDockerTestPrefix,
  isDockerAvailable,
  removeStaleDockerResources,
  sleep,
  startAttachedContainer,
  stopAttachedContainer,
  type RunningContainer,
} from '../../test-utils/docker';
import { buildDbInitSettingsSql } from './build-db-init-settings-sql';
import { readDbInitSql } from './read-db-init-sql';
import type { DbInitSettings } from './types';

const START_TIMEOUT_MS = 180_000;
const TEST_TIMEOUT_MS = 60_000;
const SUPERUSER_PASSWORD = 'superpw';
const ADMIN_PASSWORD = 'adminpw';

const dockerAvailable = isDockerAvailable();

if (!dockerAvailable) {
  console.log(
    'Skipping db-init SQL Docker tests: Docker is not available (`docker info` failed). Start Docker to run them.',
  );
}

const RESOURCE_BASE = 'tsds-dbinit-e2e';
const prefix = buildDockerTestPrefix(RESOURCE_BASE);
const pg15Name = `${prefix}-pg15`;
const pg16Name = `${prefix}-pg16`;
const localName = `${prefix}-local`;

interface SqlResult {
  ok: boolean;
  out: string;
  err: string;
}

/** psql in the container over the Unix socket (trusted), as `user` */
function psqlSocket(
  container: string,
  user: string,
  database: string,
  sql: string,
): SqlResult {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-q',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      user,
      '-d',
      database,
    ],
    { input: sql, encoding: 'utf-8' },
  );
  return {
    ok: result.status === 0,
    out: result.stdout.trim(),
    err: result.stderr,
  };
}

/** psql over TCP with a password, the way a service connects */
function psqlLogin(
  container: string,
  user: string,
  password: string,
  database: string,
  sql: string,
): SqlResult {
  const result = spawnSync(
    'docker',
    [
      'exec',
      '-i',
      '-e',
      `PGPASSWORD=${password}`,
      container,
      'psql',
      '-X',
      '-q',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
      '-h',
      '127.0.0.1',
      '-U',
      user,
      '-d',
      database,
    ],
    { input: sql, encoding: 'utf-8' },
  );
  return {
    ok: result.status === 0,
    out: result.stdout.trim(),
    err: result.stderr,
  };
}

/** Notices and warnings db-init printed (expected: none) */
const dbInitStderr: string[] = [];

/** Runs both parts of the db-init SQL as `admin`, as the jobs do */
function runDbInit(
  container: string,
  admin: string,
  settings: DbInitSettings,
): void {
  const sql = readDbInitSql();
  const prelude = `${buildDbInitSettingsSql(settings)}\n`;
  const server = psqlSocket(container, admin, 'postgres', prelude + sql.server);
  if (!server.ok) {
    throw new Error(`server part failed: ${server.err}`);
  }
  const database = psqlSocket(
    container,
    admin,
    settings.database,
    prelude + sql.database,
  );
  if (!database.ok) {
    throw new Error(`database part failed: ${database.err}`);
  }
  for (const err of [server.err, database.err]) {
    if (err.trim()) {
      dbInitStderr.push(`${settings.database}: ${err.trim()}`);
    }
  }
}

/** A refusal for lack of rights, not a failed connection */
const REFUSED = /permission denied|must be owner|must have admin option/;

function expectRefused(result: SqlResult): void {
  expect(result.ok).toBe(false);
  expect(result.err).toMatch(REFUSED);
}

/** Waits until Postgres accepts TCP connections (after initdb's restart) */
async function waitForPostgres(
  container: string,
  user: string,
  running: RunningContainer,
): Promise<void> {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ready = spawnSync(
      'docker',
      ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', user],
      { stdio: 'ignore' },
    );
    if (ready.status === 0) {
      return;
    }
    await sleep(500);
  }
  throw new Error(`Postgres did not start:\n${running.logs.join('')}`);
}

function startPostgres(
  name: string,
  image: string,
  env: Record<string, string>,
): RunningContainer {
  return startAttachedContainer(name, [
    ...Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
    image,
  ]);
}

describe.skipIf(!dockerAvailable)('db-init SQL (Docker)', () => {
  let pg15: RunningContainer | undefined;
  let pg16: RunningContainer | undefined;
  let local: RunningContainer | undefined;

  beforeAll(async () => {
    removeStaleDockerResources(RESOURCE_BASE);
    pg15 = startPostgres(pg15Name, 'postgres:15', {
      POSTGRES_PASSWORD: SUPERUSER_PASSWORD,
    });
    pg16 = startPostgres(pg16Name, 'postgres:16', {
      POSTGRES_PASSWORD: SUPERUSER_PASSWORD,
    });
    local = startPostgres(localName, 'postgres:16', {
      POSTGRES_USER: 'local-service',
      POSTGRES_PASSWORD: 'localowner',
      POSTGRES_DB: 'local-service',
    });
    await waitForPostgres(pg15Name, 'postgres', pg15);
    await waitForPostgres(pg16Name, 'postgres', pg16);
    await waitForPostgres(localName, 'local-service', local);

    const setup = (
      container: string,
      user: string,
      db: string,
      sql: string,
    ) => {
      const result = psqlSocket(container, user, db, sql);
      if (!result.ok) {
        throw new Error(`setup failed in ${db} as ${user}: ${result.err}`);
      }
    };

    // GCP and AWS on one Postgres 15 server, one cloud admin
    setup(
      pg15Name,
      'postgres',
      'postgres',
      `CREATE ROLE cloudsqlsuperuser NOLOGIN CREATEROLE CREATEDB;
       CREATE ROLE admin LOGIN PASSWORD '${ADMIN_PASSWORD}' CREATEROLE CREATEDB;
       GRANT cloudsqlsuperuser TO admin;
       CREATE ROLE "gcp-service" LOGIN PASSWORD 'gcpowner' CREATEROLE CREATEDB;
       GRANT cloudsqlsuperuser TO "gcp-service";
       CREATE DATABASE "gcp-service" OWNER cloudsqlsuperuser;`,
    );
    setup(
      pg15Name,
      'gcp-service',
      'gcp-service',
      `CREATE TABLE "User" (id serial PRIMARY KEY, email text);
       INSERT INTO "User" (email) VALUES ('a@example.test');
       CREATE TABLE _prisma_migrations (id text PRIMARY KEY);`,
    );
    // AWS: what the old db-init did, as the admin
    setup(
      pg15Name,
      'admin',
      'postgres',
      `CREATE DATABASE "aws-service";
       CREATE USER "aws-service" WITH PASSWORD 'awsowner';
       GRANT ALL PRIVILEGES ON DATABASE "aws-service" TO "aws-service";`,
    );
    setup(
      pg15Name,
      'admin',
      'aws-service',
      `GRANT ALL ON SCHEMA public TO "aws-service";
       ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "aws-service";
       ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "aws-service";`,
    );
    setup(
      pg15Name,
      'aws-service',
      'aws-service',
      `CREATE TABLE "Plan" (id serial PRIMARY KEY, name text);
       INSERT INTO "Plan" (name) VALUES ('free');`,
    );

    // Azure on Postgres 16: the admin made the databases and ran the
    // migrations
    setup(
      pg16Name,
      'postgres',
      'postgres',
      `CREATE ROLE admin LOGIN PASSWORD '${ADMIN_PASSWORD}' CREATEROLE CREATEDB;`,
    );
    setup(
      pg16Name,
      'admin',
      'postgres',
      `CREATE DATABASE "azure-service";
       CREATE DATABASE "other-service";`,
    );
    setup(
      pg16Name,
      'admin',
      'azure-service',
      `CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
       CREATE TABLE "User" (id serial PRIMARY KEY, role "Role" NOT NULL DEFAULT 'USER');
       INSERT INTO "User" DEFAULT VALUES;
       CREATE SEQUENCE ticket_number;
       CREATE FUNCTION answer() RETURNS int LANGUAGE sql AS 'SELECT 42';
       CREATE VIEW user_count AS SELECT count(*) AS n FROM "User";
       CREATE TABLE _prisma_migrations (id text PRIMARY KEY);`,
    );
    setup(
      pg16Name,
      'admin',
      'other-service',
      `CREATE TABLE secret (value text); INSERT INTO secret VALUES ('x');`,
    );

    // Local: the container's superuser is the owner and made the tables
    setup(
      localName,
      'local-service',
      'local-service',
      `CREATE TABLE "User" (id serial PRIMARY KEY, email text);
       INSERT INTO "User" (email) VALUES ('a@example.test');`,
    );

    // Twice everywhere: the second run must change nothing and not fail
    for (let run = 0; run < 2; run++) {
      runDbInit(pg15Name, 'admin', {
        owner: 'gcp-service',
        app: 'gcp-service_app',
        database: 'gcp-service',
        appPassword: 'gcpapp',
      });
      runDbInit(pg15Name, 'admin', {
        owner: 'aws-service',
        app: 'aws-service_app',
        database: 'aws-service',
        appPassword: 'awsapp',
      });
      runDbInit(pg16Name, 'admin', {
        owner: 'azure-service',
        app: 'azure-service_app',
        database: 'azure-service',
        ownerPassword: 'azureowner',
        appPassword: 'azureapp',
      });
      runDbInit(pg16Name, 'admin', {
        owner: 'other-service',
        app: 'other-service_app',
        database: 'other-service',
        ownerPassword: 'otherowner',
        appPassword: 'otherapp',
      });
      runDbInit(localName, 'local-service', {
        owner: 'local-service',
        app: 'local-service_app',
        database: 'local-service',
        appPassword: 'localapp',
      });
    }
  }, START_TIMEOUT_MS * 2);

  afterAll(async () => {
    await stopAttachedContainer(pg15Name, pg15);
    await stopAttachedContainer(pg16Name, pg16);
    await stopAttachedContainer(localName, local);
  }, 60_000);

  it('should run without notices or warnings', () => {
    expect(dbInitStderr).toEqual([]);
  });

  describe('GCP: Cloud SQL user as owner (Postgres 15)', () => {
    it(
      'should take away what Cloud SQL gives its users',
      () => {
        const roles = psqlSocket(
          pg15Name,
          'postgres',
          'postgres',
          `SELECT rolcreaterole, rolcreatedb, pg_has_role('gcp-service', 'cloudsqlsuperuser', 'MEMBER')
           FROM pg_roles WHERE rolname = 'gcp-service';`,
        );
        expect(roles.out).toBe('f|f|f');
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should let the owner keep its password and migrate',
      () => {
        const migrate = psqlLogin(
          pg15Name,
          'gcp-service',
          'gcpowner',
          'gcp-service',
          `CREATE TABLE "Session" (id serial PRIMARY KEY, token text);
           ALTER TABLE "User" ADD COLUMN name text;`,
        );
        expect(migrate.err).toBe('');
        expect(migrate.ok).toBe(true);

        // A table created after db-init is usable right away
        const app = psqlLogin(
          pg15Name,
          'gcp-service_app',
          'gcpapp',
          'gcp-service',
          `INSERT INTO "Session" (token) VALUES ('t'); SELECT count(*) FROM "Session";`,
        );
        expect(app.out).toBe('1');
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should keep both roles out of the other database',
      () => {
        expectRefused(
          psqlLogin(
            pg15Name,
            'gcp-service',
            'gcpowner',
            'aws-service',
            'SELECT 1;',
          ),
        );
        expectRefused(
          psqlLogin(
            pg15Name,
            'gcp-service_app',
            'gcpapp',
            'aws-service',
            'SELECT 1;',
          ),
        );
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should keep the owner from creating roles or databases',
      () => {
        expectRefused(
          psqlLogin(
            pg15Name,
            'gcp-service',
            'gcpowner',
            'gcp-service',
            'CREATE ROLE x;',
          ),
        );
        expectRefused(
          psqlLogin(
            pg15Name,
            'gcp-service',
            'gcpowner',
            'gcp-service',
            'CREATE DATABASE x;',
          ),
        );
        // Nor take cloudsqlsuperuser back
        expectRefused(
          psqlLogin(
            pg15Name,
            'gcp-service',
            'gcpowner',
            'gcp-service',
            'GRANT cloudsqlsuperuser TO "gcp-service";',
          ),
        );
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe('AWS: owner from the old db-init (Postgres 15)', () => {
    it(
      'should let the app role read and write rows',
      () => {
        const app = psqlLogin(
          pg15Name,
          'aws-service_app',
          'awsapp',
          'aws-service',
          `INSERT INTO "Plan" (name) VALUES ('pro');
           UPDATE "Plan" SET name = 'team' WHERE name = 'pro';
           DELETE FROM "Plan" WHERE name = 'team';
           SELECT count(*) FROM "Plan";`,
        );
        expect(app.out).toBe('1');
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should make the owner the owner of its database',
      () => {
        const owner = psqlSocket(
          pg15Name,
          'postgres',
          'postgres',
          `SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = 'aws-service';`,
        );
        expect(owner.out).toBe('aws-service');
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should keep the admin able to connect',
      () => {
        expect(
          psqlLogin(
            pg15Name,
            'admin',
            ADMIN_PASSWORD,
            'aws-service',
            'SELECT 1;',
          ).ok,
        ).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe('Azure: tables owned by the server admin (Postgres 16)', () => {
    it(
      'should give the admin-owned objects to the owner',
      () => {
        const owners = psqlSocket(
          pg16Name,
          'postgres',
          'azure-service',
          `SELECT pg_get_userbyid(relowner) FROM pg_class WHERE relname = 'User'
           UNION ALL SELECT pg_get_userbyid(relowner) FROM pg_class WHERE relname = 'User_id_seq'
           UNION ALL SELECT pg_get_userbyid(relowner) FROM pg_class WHERE relname = 'ticket_number'
           UNION ALL SELECT pg_get_userbyid(relowner) FROM pg_class WHERE relname = 'user_count'
           UNION ALL SELECT pg_get_userbyid(relowner) FROM pg_class WHERE relname = '_prisma_migrations'
           UNION ALL SELECT pg_get_userbyid(typowner) FROM pg_type WHERE typname = 'Role'
           UNION ALL SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE proname = 'answer';`,
        );
        expect(owners.out.split('\n')).toEqual(
          Array.from({ length: 7 }, () => 'azure-service'),
        );
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should let the new owner migrate with its password',
      () => {
        const migrate = psqlLogin(
          pg16Name,
          'azure-service',
          'azureowner',
          'azure-service',
          `ALTER TYPE "Role" ADD VALUE 'OWNER';
           ALTER TABLE "User" ADD COLUMN email text;
           INSERT INTO _prisma_migrations VALUES ('2');`,
        );
        expect(migrate.err).toBe('');
        expect(migrate.ok).toBe(true);
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should let the app role use the tables, enum, sequence, function and view',
      () => {
        const app = psqlLogin(
          pg16Name,
          'azure-service_app',
          'azureapp',
          'azure-service',
          `INSERT INTO "User" (role) VALUES ('ADMIN');
           SELECT nextval('ticket_number');
           SELECT answer();
           SELECT n FROM user_count;`,
        );
        expect(app.out.split('\n')).toEqual(['1', '42', '2']);
      },
      TEST_TIMEOUT_MS,
    );

    it(
      "should keep the app role out of the other service's database",
      () => {
        expectRefused(
          psqlLogin(
            pg16Name,
            'azure-service_app',
            'azureapp',
            'other-service',
            'SELECT 1;',
          ),
        );
        expectRefused(
          psqlLogin(
            pg16Name,
            'azure-service',
            'azureowner',
            'other-service',
            'SELECT 1;',
          ),
        );
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe('Local: the container superuser is the owner (Postgres 16)', () => {
    it(
      'should create the app role with its password',
      () => {
        expect(
          psqlLogin(
            localName,
            'local-service_app',
            'localapp',
            'local-service',
            'SELECT count(*) FROM "User";',
          ).out,
        ).toBe('1');
      },
      TEST_TIMEOUT_MS,
    );

    it(
      'should leave the owner a superuser with its password',
      () => {
        expect(
          psqlLogin(
            localName,
            'local-service',
            'localowner',
            'local-service',
            `SELECT rolsuper FROM pg_roles WHERE rolname = current_user;`,
          ).out,
        ).toBe('t');
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe('The app role, everywhere', () => {
    const apps: Array<[string, string, string, string, string]> = [
      ['GCP', pg15Name, 'gcp-service_app', 'gcpapp', 'gcp-service'],
      ['AWS', pg15Name, 'aws-service_app', 'awsapp', 'aws-service'],
      ['Azure', pg16Name, 'azure-service_app', 'azureapp', 'azure-service'],
      ['Local', localName, 'local-service_app', 'localapp', 'local-service'],
    ];

    it(
      'should refuse schema changes, TRUNCATE and the migration history',
      () => {
        for (const [where, container, user, password, db] of apps) {
          const table = where === 'AWS' ? '"Plan"' : '"User"';
          for (const sql of [
            'CREATE TABLE x (id int);',
            `ALTER TABLE ${table} ADD COLUMN x int;`,
            `DROP TABLE ${table};`,
            `TRUNCATE ${table};`,
            'CREATE SCHEMA x;',
            'CREATE ROLE x;',
          ]) {
            const result = psqlLogin(container, user, password, db, sql);
            expect({ where, sql, ok: result.ok }).toEqual({
              where,
              sql,
              ok: false,
            });
            expect(result.err).toMatch(REFUSED);
          }
          if (where !== 'AWS' && where !== 'Local') {
            const history = psqlLogin(
              container,
              user,
              password,
              db,
              'SELECT * FROM _prisma_migrations;',
            );
            expect({ where, ok: history.ok }).toEqual({ where, ok: false });
            expect(history.err).toMatch(REFUSED);
          }
        }
      },
      TEST_TIMEOUT_MS,
    );
  });
});
