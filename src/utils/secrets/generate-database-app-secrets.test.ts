import { describe, it, expect } from '@rstest/core';
import { generateDatabaseAppSecrets } from './generate-database-app-secrets';

describe('generateDatabaseAppSecrets', () => {
  describe('Standard use cases', () => {
    it('should name the app role after the service and point at its database', () => {
      const result = generateDatabaseAppSecrets('auth-service', 5432);

      expect(result.username).toBe('auth-service_app');
      expect(result.password.length).toBeGreaterThan(20);
      expect(result.url).toBe(
        `postgresql://auth-service_app:${encodeURIComponent(result.password)}@localhost:5432/auth-service`,
      );
    });

    it("should keep the password of an existing app role's URL", () => {
      const existing =
        'postgresql://auth-service_app:a%2Fb%2Bc%3D@localhost:5432/auth-service';

      const result = generateDatabaseAppSecrets('auth-service', 5432, existing);

      expect(result.password).toBe('a/b+c=');
      expect(result.url).toBe(existing);
    });
  });

  describe('Edge cases', () => {
    it("should make a new password when DATABASE_URL still holds the owner's URL", () => {
      const result = generateDatabaseAppSecrets(
        'auth-service',
        5432,
        'postgresql://auth-service:ownerpw@localhost:5432/auth-service',
      );

      expect(result.password).not.toBe('ownerpw');
      expect(result.username).toBe('auth-service_app');
    });

    it('should make a new password for a value that is not a database URL', () => {
      const result = generateDatabaseAppSecrets('auth-service', 5432, 'oops');

      expect(result.password.length).toBeGreaterThan(20);
    });

    it('should follow a changed port', () => {
      const result = generateDatabaseAppSecrets(
        'auth-service',
        5440,
        'postgresql://auth-service_app:pw@localhost:5432/auth-service',
      );

      expect(result.url).toBe(
        'postgresql://auth-service_app:pw@localhost:5440/auth-service',
      );
    });
  });
});
