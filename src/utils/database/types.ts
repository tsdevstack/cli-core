/**
 * Database users types
 */

/** The parts of a postgresql:// URL */
export interface PostgresUrlParts {
  user: string;
  /** Decoded */
  password: string;
  host: string;
  port: number;
  database: string;
}

/** What the db-init SQL reads (tsdevstack.* settings) */
export interface DbInitSettings {
  /** Owner role ({service}) */
  owner: string;
  /** App role ({service}_app) */
  app: string;
  /** The service's database */
  database: string;
  /** Set as the owner's password when given */
  ownerPassword?: string;
  /** Set as the app role's password when given */
  appPassword?: string;
}

/** The two parts of the db-init SQL (templates/db-init) */
export interface DbInitSql {
  /** Run in the maintenance database: roles, passwords, who connects */
  server: string;
  /** Run in the service's database: ownership, the app role's rights */
  database: string;
}
