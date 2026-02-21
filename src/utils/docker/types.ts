/**
 * TypeScript types for Docker Compose service configurations
 */

export interface DockerComposeHealthCheck {
  test: string[];
  interval?: string;
  timeout?: string;
  retries?: number;
  start_period?: string;
}

export interface DockerComposeVolume {
  type?: 'bind' | 'volume' | 'tmpfs';
  source?: string;
  target?: string;
  read_only?: boolean;
}

export interface DockerComposeBuild {
  context: string;
  dockerfile: string;
  args?: Record<string, string>;
}

export interface DockerComposeService {
  image?: string;
  build?: DockerComposeBuild;
  container_name?: string;
  restart?: string;
  platform?: string;
  environment?: Record<string, string> | string[];
  volumes?: (string | DockerComposeVolume)[];
  ports?: string[];
  networks?: string[];
  depends_on?: string[];
  command?: string | string[];
  healthcheck?: DockerComposeHealthCheck;
}

export type DockerComposeServices = Record<string, DockerComposeService>;

/**
 * pgAdmin server configuration
 */
export interface PgAdminServer {
  Name: string;
  Group: string;
  Host: string;
  Port: number;
  MaintenanceDB: string;
  Username: string;
  SSLMode: string;
}

export type PgAdminServers = Record<string, PgAdminServer>;

/**
 * Infrastructure configuration for databases
 */
export interface InfrastructureDatabase {
  port?: number;
}

export interface Infrastructure {
  databases?: Record<string, InfrastructureDatabase>;
}

/**
 * Environment configuration
 */
export type Environments = Record<string, Record<string, string | number | boolean>>;