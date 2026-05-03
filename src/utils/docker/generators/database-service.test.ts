import { describe, it, expect } from '@rstest/core';
import { generateDatabaseService } from './database-service';

describe('generateDatabaseService', () => {
  describe('Standard use cases', () => {
    it('should generate PostgreSQL service config for auth-service', () => {
      const result = generateDatabaseService(
        'auth-service',
        5432,
        'test-network',
      );

      expect(result).toHaveProperty('auth-db');
      const service = result['auth-db'];
      expect(service.image).toBe('postgres:16');
      expect(service.ports).toEqual(['5432:5432']);
      expect(service.networks).toEqual(['test-network']);
    });

    it('should derive container name using getDbServiceName', () => {
      const result = generateDatabaseService('offers-service', 5433, 'net');

      expect(result).toHaveProperty('offers-db');
    });

    it('should set environment variables with uppercase prefix', () => {
      const result = generateDatabaseService('auth-service', 5432, 'net');
      const env = result['auth-db'].environment as Record<string, string>;

      expect(env.POSTGRES_DB).toBe('auth-service');
      expect(env.POSTGRES_USER).toBe('${AUTH_DB_USER}');
      expect(env.POSTGRES_PASSWORD).toBe('${AUTH_DB_PASSWORD}');
    });

    it('should handle multi-word service names with hyphens', () => {
      const result = generateDatabaseService(
        'user-profile-service',
        5434,
        'net',
      );
      const env = result['user-profile-db'].environment as Record<
        string,
        string
      >;

      expect(env.POSTGRES_USER).toBe('${USER_PROFILE_DB_USER}');
      expect(env.POSTGRES_PASSWORD).toBe('${USER_PROFILE_DB_PASSWORD}');
    });

    it('should set volume mount for data persistence', () => {
      const result = generateDatabaseService('auth-service', 5432, 'net');

      expect(result['auth-db'].volumes).toEqual([
        './data/auth-db:/var/lib/postgresql/data',
      ]);
    });

    it('should map the provided port to internal 5432', () => {
      const result = generateDatabaseService('auth-service', 5433, 'net');

      expect(result['auth-db'].ports).toEqual(['5433:5432']);
    });
  });

  describe('Healthcheck', () => {
    it('should declare a pg_isready healthcheck', () => {
      const result = generateDatabaseService('auth-service', 5432, 'net');

      const healthcheck = result['auth-db'].healthcheck;
      expect(healthcheck).toBeDefined();
      expect(healthcheck!.test).toEqual([
        'CMD-SHELL',
        'pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB',
      ]);
    });

    it('should use compose-escaped $$ env vars to keep credentials out of the rendered compose', () => {
      const result = generateDatabaseService('auth-service', 5432, 'net');

      const test = result['auth-db'].healthcheck!.test as string[];
      const cmd = test[1];
      expect(cmd).toContain('$$POSTGRES_USER');
      expect(cmd).toContain('$$POSTGRES_DB');
    });

    it('should set retry/timeout knobs that tolerate cold-start initdb', () => {
      const result = generateDatabaseService('auth-service', 5432, 'net');

      const hc = result['auth-db'].healthcheck!;
      expect(hc.interval).toBe('5s');
      expect(hc.timeout).toBe('3s');
      expect(hc.retries).toBe(10);
      expect(hc.start_period).toBe('15s');
    });
  });
});
