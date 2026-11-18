import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockLoadServiceSecrets } = rs.hoisted(() => ({
  mockLoadServiceSecrets: rs.fn(),
}));

rs.mock('../secrets', () => ({
  loadServiceSecrets: mockLoadServiceSecrets,
}));

import { getMigrationDatabaseUrl } from './get-migration-database-url';

describe('getMigrationDatabaseUrl', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it("should return the owner's MIGRATION_DATABASE_URL, not the app role's DATABASE_URL", () => {
    mockLoadServiceSecrets.mockReturnValue({
      DATABASE_URL:
        'postgresql://auth-service_app:app@localhost:5432/auth-service',
      MIGRATION_DATABASE_URL:
        'postgresql://auth-service:owner@localhost:5432/auth-service',
    });

    expect(getMigrationDatabaseUrl('auth-service')).toBe(
      'postgresql://auth-service:owner@localhost:5432/auth-service',
    );
  });

  it('should fall back to DATABASE_URL (secrets made before the app role) with localhost replacing Docker hostname', () => {
    mockLoadServiceSecrets.mockReturnValue({
      DATABASE_URL: 'postgresql://user:pass@auth-db:5432/auth',
    });

    const result = getMigrationDatabaseUrl('auth-service');

    expect(result).toBe('postgresql://user:pass@localhost:5432/auth');
  });

  it('should return null when service secrets not found', () => {
    mockLoadServiceSecrets.mockReturnValue(null);

    expect(getMigrationDatabaseUrl('missing-service')).toBeNull();
  });

  it('should return null when DATABASE_URL is not set', () => {
    mockLoadServiceSecrets.mockReturnValue({
      API_KEY: 'some-key',
    });

    expect(getMigrationDatabaseUrl('auth-service')).toBeNull();
  });

  it('should return null when DATABASE_URL is not a string', () => {
    mockLoadServiceSecrets.mockReturnValue({
      DATABASE_URL: 123,
    });

    expect(getMigrationDatabaseUrl('auth-service')).toBeNull();
  });

  it('should handle different Docker hostnames', () => {
    mockLoadServiceSecrets.mockReturnValue({
      DATABASE_URL: 'postgresql://user:pass@offers-db:5432/offers',
    });

    const result = getMigrationDatabaseUrl('offers-service');

    expect(result).toBe('postgresql://user:pass@localhost:5432/offers');
  });

  it('should pass service name to loadServiceSecrets', () => {
    mockLoadServiceSecrets.mockReturnValue(null);

    getMigrationDatabaseUrl('auth-service');

    expect(mockLoadServiceSecrets).toHaveBeenCalledWith('auth-service');
  });
});
