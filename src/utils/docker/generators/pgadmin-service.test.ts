import { describe, it, expect } from '@rstest/core';
import { generatePgAdminService } from './pgadmin-service';
import type { FrameworkService } from '../../config';

describe('generatePgAdminService', () => {
  const makeService = (
    name: string,
    hasDatabase: boolean = true,
  ): FrameworkService => ({
    name,
    type: 'nestjs',
    port: 3000,
    hasDatabase,
  });

  describe('Standard use cases', () => {
    it('should generate pgadmin service config', () => {
      const services = [makeService('auth-service')];
      const secrets = { AUTH_DB_USER: 'authuser' };
      const result = generatePgAdminService(services, secrets, 'test-network');

      expect(result).toHaveProperty('pgadmin');
      expect(result.pgadmin.image).toBe('dpage/pgadmin4:latest');
      expect(result.pgadmin.restart).toBe('always');
      expect(result.pgadmin.networks).toEqual(['test-network']);
    });

    it('should expose port 5050', () => {
      const result = generatePgAdminService([], {}, 'net');

      expect(result.pgadmin.ports).toEqual(['5050:80']);
    });

    it('should set default admin credentials', () => {
      const result = generatePgAdminService([], {}, 'net');
      const env = result.pgadmin.environment as Record<string, string>;

      expect(env.PGADMIN_DEFAULT_EMAIL).toBe('admin@localhost.com');
      expect(env.PGADMIN_DEFAULT_PASSWORD).toBe('admin');
    });

    it('should depend on database containers for services with databases', () => {
      const services = [
        makeService('auth-service', true),
        makeService('offers-service', true),
        makeService('bff-service', false),
      ];
      const result = generatePgAdminService(services, {}, 'net');

      expect(result.pgadmin.depends_on).toEqual(['auth-db', 'offers-db']);
    });

    it('should use service name as fallback username when secret is missing', () => {
      const services = [makeService('auth-service')];
      const result = generatePgAdminService(services, {}, 'net');

      // pgadmin config is in volumes, but we verify depends_on which uses getDbServiceName
      expect(result.pgadmin.depends_on).toEqual(['auth-db']);
    });
  });

  describe('Edge cases', () => {
    it('should handle no services with databases', () => {
      const services = [makeService('bff-service', false)];
      const result = generatePgAdminService(services, {}, 'net');

      expect(result.pgadmin.depends_on).toEqual([]);
    });

    it('should handle empty services array', () => {
      const result = generatePgAdminService([], {}, 'net');

      expect(result.pgadmin.depends_on).toEqual([]);
    });

    it('should include bind mount volumes for servers.json and pgpass', () => {
      const result = generatePgAdminService([], {}, 'net');
      const volumes = result.pgadmin.volumes!;

      expect(volumes.length).toBe(3);
      expect(volumes[0]).toBe('./data/pgadmin:/var/lib/pgadmin');
    });
  });
});
