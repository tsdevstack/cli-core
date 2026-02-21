import { describe, it, expect } from '@rstest/core';
import { buildSecretName } from './build-secret-name';

describe('buildSecretName', () => {
  it('should build secret name with project, scope, and key', () => {
    const result = buildSecretName('myproject', 'shared', 'DATABASE_URL');
    expect(result).toBe('myproject-shared-DATABASE_URL');
  });

  it('should work with service scope', () => {
    const result = buildSecretName('myproject', 'auth-service', 'API_KEY');
    expect(result).toBe('myproject-auth-service-API_KEY');
  });

  it('should handle different project names', () => {
    const result = buildSecretName('another-project', 'shared', 'SECRET');
    expect(result).toBe('another-project-shared-SECRET');
  });

  it('should handle complex key names', () => {
    const result = buildSecretName('proj', 'shared', 'MY_COMPLEX_SECRET_KEY');
    expect(result).toBe('proj-shared-MY_COMPLEX_SECRET_KEY');
  });

  it('should handle minimal inputs', () => {
    const result = buildSecretName('p', 's', 'K');
    expect(result).toBe('p-s-K');
  });
});
