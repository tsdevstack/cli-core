import { describe, it, expect } from '@rstest/core';
import { buildDatabaseAppRole } from './build-database-app-role';

describe('buildDatabaseAppRole', () => {
  describe('Standard use cases', () => {
    it('should add _app to the service name', () => {
      expect(buildDatabaseAppRole('auth-service')).toBe('auth-service_app');
    });
  });

  describe('Edge cases', () => {
    it('should keep a name without -service as it is', () => {
      expect(buildDatabaseAppRole('billing')).toBe('billing_app');
    });
  });
});
