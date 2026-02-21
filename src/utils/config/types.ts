/**
 * TypeScript interfaces for framework configuration
 */

export type Environments = Record<
  string,
  Record<string, string | number | boolean>
>;

export interface CloudConfig {
  provider: 'gcp' | 'aws' | 'azure' | null;
}

/**
 * Framework template types:
 * - 'fullstack-auth': Backend auth service + Next.js with auth pages
 * - 'auth': Backend auth service only
 * - null: No framework auth, user manages their own
 */
export type FrameworkTemplate = 'fullstack-auth' | 'auth' | null;

export interface FrameworkConfig {
  project: {
    name: string;
    version: string;
    description?: string;
  };
  framework?: {
    version?: string;
    type?: string;
    packageScope?: string;
    /** Framework template for authentication setup. */
    template?: FrameworkTemplate;
  };
  cloud: CloudConfig;
  services: FrameworkService[];
  environments?: Environments;
}

export interface FrameworkService {
  name: string;
  type: string;
  /** Port number. Required for nestjs/nextjs/spa, not used for workers. */
  port?: number;
  globalPrefix?: string;
  hasDatabase?: boolean;
  databaseType?: string;
  databasePort?: number;
  /**
   * For worker services: the base service this worker is derived from.
   * Workers share the same Docker image as their base service.
   * Example: auth-worker with baseService: "auth-service"
   */
  baseService?: string;
}
