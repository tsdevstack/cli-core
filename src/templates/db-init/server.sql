-- tsdevstack db-init, server part: the two roles of one service and who may
-- connect to its database. Run as the admin login (locally the container's
-- superuser, which is the owner role) in the server's maintenance database.
-- The same text runs locally (psql in the Postgres container) and in each
-- cloud's db-init job. Safe to run again: every step checks first.
--
-- Settings the caller sets first (SET or set_config):
--   tsdevstack.owner           owner role ({service}): owns the tables, used by migrations
--   tsdevstack.app             app role ({service}_app): reads and writes rows
--   tsdevstack.database        the service's database (must exist)
--   tsdevstack.owner_password  the owner's password, set when not empty
--   tsdevstack.app_password    the app role's password, set when not empty
DO $db_init$
DECLARE
  owner_role text := current_setting('tsdevstack.owner');
  app_role text := current_setting('tsdevstack.app');
  db text := current_setting('tsdevstack.database');
  owner_password text := coalesce(current_setting('tsdevstack.owner_password', true), '');
  app_password text := coalesce(current_setting('tsdevstack.app_password', true), '');
  -- Postgres 16 records a grantor per membership and splits SET from INHERIT
  pg16 boolean := current_setting('server_version_num')::int >= 160000;
  role_name text;
  membership record;
BEGIN
  IF NOT EXISTS (SELECT FROM pg_database WHERE datname = db) THEN
    RAISE EXCEPTION 'tsdevstack db-init: database "%" does not exist', db;
  END IF;

  -- Both roles log in and can't create roles or databases
  FOREACH role_name IN ARRAY ARRAY[owner_role, app_role] LOOP
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('CREATE ROLE %I LOGIN NOCREATEDB NOCREATEROLE', role_name);
    END IF;

    -- Locally the owner is the container's own superuser: this script runs
    -- as it and leaves it as it is
    IF role_name <> current_user THEN
      EXECUTE format('ALTER ROLE %I LOGIN NOCREATEDB NOCREATEROLE', role_name);

      -- Memberships it was given (Cloud SQL makes its users members of
      -- cloudsqlsuperuser, which can create roles and databases)
      FOR membership IN
        SELECT r.rolname AS role_name, g.rolname AS grantor
        FROM pg_auth_members m
        JOIN pg_roles r ON r.oid = m.roleid
        JOIN pg_roles g ON g.oid = m.grantor
        WHERE m.member = (SELECT oid FROM pg_roles WHERE rolname = role_name)
      LOOP
        IF pg16 THEN
          EXECUTE format('REVOKE %I FROM %I GRANTED BY %I',
            membership.role_name, role_name, membership.grantor);
        ELSE
          EXECUTE format('REVOKE %I FROM %I', membership.role_name, role_name);
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  -- The admin acts as the owner here and in the database part (ownership
  -- changes, default privileges), so it needs the owner's role
  IF owner_role <> current_user
    AND NOT pg_has_role(current_user, owner_role, CASE WHEN pg16 THEN 'SET' ELSE 'MEMBER' END)
  THEN
    IF pg16 THEN
      EXECUTE format('GRANT %I TO %I WITH INHERIT TRUE, SET TRUE', owner_role, current_user);
    ELSE
      EXECUTE format('GRANT %I TO %I', owner_role, current_user);
    END IF;
  END IF;

  IF owner_password <> '' THEN
    EXECUTE format('ALTER ROLE %I PASSWORD %L', owner_role, owner_password);
  END IF;
  IF app_password <> '' THEN
    EXECUTE format('ALTER ROLE %I PASSWORD %L', app_role, app_password);
  END IF;

  -- The owner owns its database, and with it (Postgres 15 and later) the
  -- public schema, except on Azure (the database part grants its rights)
  IF (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = db) <> owner_role THEN
    EXECUTE format('ALTER DATABASE %I OWNER TO %I', db, owner_role);
  END IF;

  -- Only the service's own roles and the admin connect to it
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', db);
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', db, app_role);
  IF owner_role <> current_user THEN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', db, current_user);
  END IF;
END
$db_init$;
