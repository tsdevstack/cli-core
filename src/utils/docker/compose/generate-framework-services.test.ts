import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('../../logger', () => ({
  logger: {
    info: rs.fn(),
    success: rs.fn(),
    warn: rs.fn(),
    error: rs.fn(),
  },
}));

import { generateFrameworkServices } from './generate-framework-services';
import type { FrameworkConfig } from '../../config';

function makeConfig(
  services: FrameworkConfig['services'] = [],
): FrameworkConfig {
  return {
    project: { name: 'test-project', version: '1.0.0' },
    cloud: { provider: 'gcp' },
    services,
  };
}

describe('generateFrameworkServices', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should include kong, redis, and redis-commander services', () => {
      const config = makeConfig();
      const result = generateFrameworkServices(config, {});

      expect(result).toHaveProperty('gateway');
      expect(result).toHaveProperty('redis');
      expect(result).toHaveProperty('redis-commander');
    });

    it('should include monitoring services (prometheus, grafana, jaeger)', () => {
      const config = makeConfig();
      const result = generateFrameworkServices(config, {});

      expect(result).toHaveProperty('prometheus');
      expect(result).toHaveProperty('grafana');
      expect(result).toHaveProperty('jaeger');
    });

    it('should include pgadmin service', () => {
      const config = makeConfig();
      const result = generateFrameworkServices(config, {});

      expect(result).toHaveProperty('pgadmin');
    });

    it('should derive network name from project name', () => {
      const config = makeConfig();
      const result = generateFrameworkServices(config, {});

      // All services should use the derived network
      expect(result.gateway.networks).toEqual(['test-project-network']);
      expect(result.redis.networks).toEqual(['test-project-network']);
    });

    it('should generate database services for services with hasDatabase', () => {
      const config = makeConfig([
        {
          name: 'auth-service',
          type: 'nestjs',
          port: 3001,
          hasDatabase: true,
          databaseType: 'postgresql',
        },
      ]);
      const secrets = { AUTH_DB_PASSWORD: 'pass123' };
      const result = generateFrameworkServices(config, secrets);

      expect(result).toHaveProperty('auth-db');
    });

    it('should use databasePort from service config when available', () => {
      const config = makeConfig([
        {
          name: 'auth-service',
          type: 'nestjs',
          port: 3001,
          hasDatabase: true,
          databaseType: 'postgresql',
          databasePort: 5555,
        },
      ]);
      const secrets = { AUTH_DB_PASSWORD: 'pass123' };
      const result = generateFrameworkServices(config, secrets);

      expect(result['auth-db'].ports).toEqual(['5555:5432']);
    });

    it('should skip services without hasDatabase flag', () => {
      const config = makeConfig([
        { name: 'bff-service', type: 'nestjs', port: 3002, hasDatabase: false },
      ]);
      const result = generateFrameworkServices(config, {});

      expect(result).not.toHaveProperty('bff-db');
    });
  });

  describe('Error handling', () => {
    it('should throw when database password is missing', () => {
      const config = makeConfig([
        {
          name: 'auth-service',
          type: 'nestjs',
          port: 3001,
          hasDatabase: true,
          databaseType: 'postgresql',
        },
      ]);

      expect(() => generateFrameworkServices(config, {})).toThrow(
        'Database password not found for auth-service',
      );
    });
  });
});
