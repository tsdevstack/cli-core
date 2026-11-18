-- tsdevstack db-init, database part: who owns the service's tables and what
-- the app role may do with them. Run after the server part, as the same
-- admin login, in the service's database. The same text runs locally and in
-- each cloud's db-init job. Safe to run again: every step checks first.
--
-- Settings the caller sets first (SET or set_config):
--   tsdevstack.owner  owner role ({service})
--   tsdevstack.app    app role ({service}_app)
DO $db_init$
DECLARE
  owner_role text := current_setting('tsdevstack.owner');
  app_role text := current_setting('tsdevstack.app');
  owner_oid oid := (SELECT oid FROM pg_roles WHERE rolname = current_setting('tsdevstack.owner'));
  admin_oid oid := (SELECT oid FROM pg_roles WHERE rolname = current_user);
  item record;
BEGIN
  -- What the admin owns in the service's schemas becomes the owner's (on
  -- Azure the migrations ran as the server admin until now). Objects that
  -- belong to an extension stay as they are.
  IF owner_role <> current_user THEN
    FOR item IN
      SELECT n.nspname FROM pg_namespace n
      WHERE n.nspowner = admin_oid
        AND n.nspname NOT LIKE 'pg\_%' AND n.nspname <> 'information_schema'
        AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.objid = n.oid AND d.deptype = 'e')
    LOOP
      EXECUTE format('ALTER SCHEMA %I OWNER TO %I', item.nspname, owner_role);
    END LOOP;

    -- Tables (their indexes and column sequences move with them), views,
    -- materialized views, foreign tables
    FOR item IN
      SELECT n.nspname, c.relname,
        CASE c.relkind
          WHEN 'v' THEN 'VIEW'
          WHEN 'm' THEN 'MATERIALIZED VIEW'
          WHEN 'f' THEN 'FOREIGN TABLE'
          ELSE 'TABLE'
        END AS kind
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relowner = admin_oid AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
        AND n.nspname NOT LIKE 'pg\_%' AND n.nspname <> 'information_schema'
        AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
    LOOP
      EXECUTE format('ALTER %s %I.%I OWNER TO %I', item.kind, item.nspname, item.relname, owner_role);
    END LOOP;

    -- Sequences not tied to a column (those moved with their table)
    FOR item IN
      SELECT n.nspname, c.relname
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relowner = admin_oid AND c.relkind = 'S'
        AND n.nspname NOT LIKE 'pg\_%' AND n.nspname <> 'information_schema'
        AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.objid = c.oid AND d.deptype IN ('a', 'i', 'e'))
    LOOP
      EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO %I', item.nspname, item.relname, owner_role);
    END LOOP;

    -- Enums, domains, composite and range types (Prisma makes its enums
    -- with CREATE TYPE). Array types and a table's row type move along.
    FOR item IN
      SELECT n.nspname, t.typname,
        CASE t.typtype WHEN 'd' THEN 'DOMAIN' ELSE 'TYPE' END AS kind
      FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typowner = admin_oid AND t.typtype IN ('e', 'd', 'c', 'r')
        AND (t.typtype <> 'c' OR (SELECT relkind FROM pg_class WHERE oid = t.typrelid) = 'c')
        AND NOT EXISTS (SELECT FROM pg_type e WHERE e.typarray = t.oid)
        AND n.nspname NOT LIKE 'pg\_%' AND n.nspname <> 'information_schema'
        AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.objid = t.oid AND d.deptype = 'e')
    LOOP
      EXECUTE format('ALTER %s %I.%I OWNER TO %I', item.kind, item.nspname, item.typname, owner_role);
    END LOOP;

    -- Functions and procedures (a raw SQL migration's triggers, for example)
    FOR item IN
      SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args,
        CASE p.prokind WHEN 'p' THEN 'PROCEDURE' WHEN 'a' THEN 'AGGREGATE' ELSE 'FUNCTION' END AS kind
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proowner = admin_oid
        AND n.nspname NOT LIKE 'pg\_%' AND n.nspname <> 'information_schema'
        AND NOT EXISTS (SELECT FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
    LOOP
      EXECUTE format('ALTER %s %I.%I(%s) OWNER TO %I', item.kind, item.nspname, item.proname, item.args, owner_role);
    END LOOP;
  END IF;

  -- Nobody else creates objects in the public schema (the default from
  -- Postgres 15 on)
  IF EXISTS (SELECT FROM pg_namespace WHERE nspname = 'public') THEN
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;

    -- The owner does: from Postgres 15 on the database's owner owns the
    -- public schema, except on Azure, where azure_pg_admin owns it in every
    -- database. There the owner gets its rights here (locally, on GCP and
    -- AWS it already has them).
    IF NOT has_schema_privilege(owner_role, 'public', 'CREATE')
      OR NOT has_schema_privilege(owner_role, 'public', 'USAGE')
    THEN
      EXECUTE format('GRANT USAGE, CREATE ON SCHEMA public TO %I', owner_role);
    END IF;
  END IF;

  -- The app role reads and writes rows in the owner's schemas: no schema
  -- changes, no TRUNCATE
  FOR item IN
    SELECT n.nspname FROM pg_namespace n
    WHERE n.nspname = 'public' OR n.nspowner = owner_oid
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I', item.nspname, app_role);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO %I', item.nspname, app_role);
    EXECUTE format('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA %I TO %I', item.nspname, app_role);
  END LOOP;

  -- The same for what the owner's migrations create later
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', owner_role, app_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO %I', owner_role, app_role);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I GRANT USAGE ON SCHEMAS TO %I', owner_role, app_role);

  -- The migration history is the owner's alone
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON public._prisma_migrations FROM %I', app_role);
  END IF;
END
$db_init$;
