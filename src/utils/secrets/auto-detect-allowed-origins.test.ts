import { describe, it, expect } from '@rstest/core';
import { autoDetectAllowedOrigins } from './auto-detect-allowed-origins';
import { createMockFrameworkConfig } from '../../test-fixtures/framework-config';

describe('autoDetectAllowedOrigins', () => {
  it('should return comma-separated origins for multiple frontend services', () => {
    const config = createMockFrameworkConfig({
      services: [
        { name: 'frontend', type: 'nextjs', port: 3000 },
        { name: 'admin', type: 'spa', port: 3001 },
        { name: 'api', type: 'nestjs', port: 4000 },
      ],
    });

    const result = autoDetectAllowedOrigins(config);

    expect(result).toBe('http://localhost:3000,http://localhost:3001');
  });

  it('should return single origin for one frontend service', () => {
    const config = createMockFrameworkConfig({
      services: [
        { name: 'frontend', type: 'nextjs', port: 3000 },
        { name: 'api', type: 'nestjs', port: 4000 },
      ],
    });

    const result = autoDetectAllowedOrigins(config);

    expect(result).toBe('http://localhost:3000');
  });

  it('should return null when no frontend services exist', () => {
    const config = createMockFrameworkConfig({
      services: [
        { name: 'api', type: 'nestjs', port: 4000 },
        { name: 'worker', type: 'nestjs', port: 4001 },
      ],
    });

    const result = autoDetectAllowedOrigins(config);

    expect(result).toBeNull();
  });

  it('should return null when services array is empty', () => {
    const config = createMockFrameworkConfig();

    const result = autoDetectAllowedOrigins(config);

    expect(result).toBeNull();
  });

  it('should handle all frontend types (nextjs, spa)', () => {
    const config = createMockFrameworkConfig({
      services: [
        { name: 'nextjs-app', type: 'nextjs', port: 3000 },
        { name: 'spa-app', type: 'spa', port: 3001 },
      ],
    });

    const result = autoDetectAllowedOrigins(config);

    expect(result).toBe('http://localhost:3000,http://localhost:3001');
  });

  it('should only include frontend services, not backend services', () => {
    const config = createMockFrameworkConfig({
      services: [
        { name: 'frontend', type: 'spa', port: 3000 },
        { name: 'auth-api', type: 'nestjs', port: 4000 },
        { name: 'user-api', type: 'nestjs', port: 4001 },
        { name: 'admin', type: 'spa', port: 3001 },
      ],
    });

    const result = autoDetectAllowedOrigins(config);

    expect(result).toBe('http://localhost:3000,http://localhost:3001');
    expect(result).not.toContain('4000');
    expect(result).not.toContain('4001');
  });

  it('should handle custom ports correctly', () => {
    const config = createMockFrameworkConfig({
      services: [
        { name: 'frontend', type: 'nextjs', port: 8080 },
        { name: 'admin', type: 'spa', port: 9000 },
      ],
    });

    const result = autoDetectAllowedOrigins(config);

    expect(result).toBe('http://localhost:8080,http://localhost:9000');
  });
});
