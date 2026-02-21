import { describe, it, expect } from '@rstest/core';
import { getDbServiceName } from './get-db-service-name';

describe('getDbServiceName', () => {
  it('should replace -service suffix with -db', () => {
    expect(getDbServiceName('auth-service')).toBe('auth-db');
  });

  it('should handle multi-word service names', () => {
    expect(getDbServiceName('offers-service')).toBe('offers-db');
  });

  it('should append -db when no -service suffix', () => {
    expect(getDbServiceName('demo')).toBe('demo-db');
  });

  it('should only replace first occurrence of -service', () => {
    expect(getDbServiceName('service-service')).toBe('service-db');
  });
});
