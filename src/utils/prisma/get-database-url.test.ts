import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockLoadServiceSecrets } = rs.hoisted(() => ({
  mockLoadServiceSecrets: rs.fn(),
}));

rs.mock('../secrets', () => ({
  loadServiceSecrets: mockLoadServiceSecrets,
}));

import { getDatabaseUrl } from './get-database-url';

describe('getDatabaseUrl', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should return DATABASE_URL with localhost replacing Docker hostname', () => {
    mockLoadServiceSecrets.mockReturnValue({
      DATABASE_URL: 'postgresql://user:pass@auth-db:5432/auth',
    });

    const result = getDatabaseUrl('auth-service');

    expect(result).toBe('postgresql://user:pass@localhost:5432/auth');
  });

  it('should return null when service secrets not found', () => {
    mockLoadServiceSecrets.mockReturnValue(null);

    expect(getDatabaseUrl('missing-service')).toBeNull();
  });

  it('should return null when DATABASE_URL is not set', () => {
    mockLoadServiceSecrets.mockReturnValue({
      API_KEY: 'some-key',
    });

    expect(getDatabaseUrl('auth-service')).toBeNull();
  });

  it('should return null when DATABASE_URL is not a string', () => {
    mockLoadServiceSecrets.mockReturnValue({
      DATABASE_URL: 123,
    });

    expect(getDatabaseUrl('auth-service')).toBeNull();
  });

  it('should handle different Docker hostnames', () => {
    mockLoadServiceSecrets.mockReturnValue({
      DATABASE_URL: 'postgresql://user:pass@offers-db:5432/offers',
    });

    const result = getDatabaseUrl('offers-service');

    expect(result).toBe('postgresql://user:pass@localhost:5432/offers');
  });

  it('should pass service name to loadServiceSecrets', () => {
    mockLoadServiceSecrets.mockReturnValue(null);

    getDatabaseUrl('auth-service');

    expect(mockLoadServiceSecrets).toHaveBeenCalledWith('auth-service');
  });
});
