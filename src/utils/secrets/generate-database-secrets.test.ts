import { describe, it, expect } from '@rstest/core';
import { generateDatabaseSecrets } from './generate-database-secrets';

describe('generateDatabaseSecrets', () => {
  describe('Standard service names', () => {
    it('should generate random credentials when not provided', () => {
      const result = generateDatabaseSecrets('auth-service', 5432);

      // Username matches service name (aligned with GCP/AWS)
      expect(result.username).toBe('auth-service');
      // Password should be a secure random string
      expect(result.password).toBeTruthy();
      expect(result.password.length).toBeGreaterThan(20); // Base64 32-byte secret
      expect(result.database).toBe('auth-service');
      expect(result.url).toBe(
        `postgresql://auth-service:${encodeURIComponent(result.password)}@localhost:5432/auth-service`,
      );
    });

    it('should generate secrets for user-service', () => {
      const result = generateDatabaseSecrets('user-service', 5433);

      expect(result.username).toBe('user-service');
      expect(result.password).toBeTruthy();
      expect(result.database).toBe('user-service');
      expect(result.url).toBe(
        `postgresql://user-service:${encodeURIComponent(result.password)}@localhost:5433/user-service`,
      );
    });

    it('should use full service name as database name', () => {
      const result = generateDatabaseSecrets('demo-service', 5434);

      expect(result.database).toBe('demo-service');
      expect(result.url).toContain('/demo-service');
    });
  });

  describe('Service names without -service suffix', () => {
    it('should handle service name without -service suffix', () => {
      const result = generateDatabaseSecrets('auth', 5432);

      expect(result.database).toBe('auth');
      expect(result.url).toContain('/auth');
    });

    it('should handle api as service name', () => {
      const result = generateDatabaseSecrets('api', 5432);

      expect(result.database).toBe('api');
      expect(result.url).toContain('/api');
    });
  });

  describe('Multi-word service names', () => {
    it('should use full service name for hyphenated names', () => {
      const result = generateDatabaseSecrets('auth-management-service', 5432);

      expect(result.database).toBe('auth-management-service');
      expect(result.url).toContain('/auth-management-service');
    });

    it('should use full service name including -service suffix', () => {
      const result = generateDatabaseSecrets('service-manager-service', 5432);

      expect(result.database).toBe('service-manager-service');
      expect(result.url).toContain('/service-manager-service');
    });
  });

  describe('Database port variations', () => {
    it('should handle default PostgreSQL port 5432', () => {
      const result = generateDatabaseSecrets('auth-service', 5432);

      expect(result.url).toContain(':5432/');
    });

    it('should handle custom port 5433', () => {
      const result = generateDatabaseSecrets('user-service', 5433);

      expect(result.url).toContain(':5433/');
    });

    it('should handle high port number', () => {
      const result = generateDatabaseSecrets('test-service', 15432);

      expect(result.url).toContain(':15432/');
    });
  });

  describe('URL format', () => {
    it('should generate valid PostgreSQL URL format', () => {
      const result = generateDatabaseSecrets('auth-service', 5432);

      expect(result.url).toMatch(/^postgresql:\/\/.+:.+@localhost:\d+\/.+$/);
    });

    it('should use localhost as host', () => {
      const result = generateDatabaseSecrets('auth-service', 5432);

      expect(result.url).toContain('@localhost:');
    });

    it('should include credentials in URL', () => {
      const result = generateDatabaseSecrets('auth-service', 5432);

      expect(result.url).toContain(
        `${result.username}:${encodeURIComponent(result.password)}`,
      );
    });
  });

  describe('Credential preservation', () => {
    it('should preserve existing username when provided', () => {
      const existingUsername = 'existing_auth_user';
      const result = generateDatabaseSecrets(
        'auth-service',
        5432,
        existingUsername,
      );

      expect(result.username).toBe(existingUsername);
      expect(result.url).toContain(existingUsername);
    });

    it('should preserve existing password when provided', () => {
      const existingPassword = 'existing_secure_password_123';
      const result = generateDatabaseSecrets(
        'auth-service',
        5432,
        undefined,
        existingPassword,
      );

      expect(result.password).toBe(existingPassword);
      expect(result.url).toContain(existingPassword);
    });

    it('should preserve both username and password when provided', () => {
      const existingUsername = 'my_custom_user';
      const existingPassword = 'my_custom_pass';
      const result = generateDatabaseSecrets(
        'auth-service',
        5432,
        existingUsername,
        existingPassword,
      );

      expect(result.username).toBe(existingUsername);
      expect(result.password).toBe(existingPassword);
      expect(result.url).toBe(
        `postgresql://${existingUsername}:${existingPassword}@localhost:5432/auth-service`,
      );
    });

    it('should generate new credentials when both are undefined', () => {
      const result = generateDatabaseSecrets(
        'auth-service',
        5432,
        undefined,
        undefined,
      );

      expect(result.username).toBe('auth-service');
      expect(result.password).toBeTruthy();
      expect(result.password.length).toBeGreaterThan(20);
    });
  });

  describe('Return value structure', () => {
    it('should return all required fields', () => {
      const result = generateDatabaseSecrets('auth-service', 5432);

      expect(result).toHaveProperty('password');
      expect(result).toHaveProperty('username');
      expect(result).toHaveProperty('database');
      expect(result).toHaveProperty('url');
    });

    it('should generate secure random credentials by default', () => {
      const result1 = generateDatabaseSecrets('auth-service', 5432);
      const result2 = generateDatabaseSecrets('auth-service', 5432);

      // Each call should generate different passwords
      expect(result1.password).not.toBe(result2.password);
      // But usernames should be consistent based on service name
      expect(result1.username).toBe(result2.username);
      expect(result1.username).toBe('auth-service');
    });
  });

  describe('Invalid service names', () => {
    it('should throw for empty service name', () => {
      expect(() => generateDatabaseSecrets('', 5432)).toThrow();
    });

    it('should throw for service name with uppercase', () => {
      expect(() => generateDatabaseSecrets('Auth-Service', 5432)).toThrow();
    });

    it('should throw for service name with spaces', () => {
      expect(() => generateDatabaseSecrets('auth service', 5432)).toThrow();
    });

    it('should throw for service name with underscores', () => {
      expect(() => generateDatabaseSecrets('auth_service', 5432)).toThrow();
    });
  });
});
