import { describe, it, expect } from '@rstest/core';
import { getNextPort } from './get-next-port';
import type { FrameworkConfig } from '../config/types';

function makeConfig(
  services: Array<{ name: string; port?: number }>,
): FrameworkConfig {
  return {
    project: { name: 'test', version: '1.0.0' },
    cloud: { provider: null },
    services: services.map((s) => ({ ...s, type: 'nestjs' })),
  };
}

describe('getNextPort', () => {
  it('should return 3000 when no services exist', () => {
    expect(getNextPort(makeConfig([]))).toBe(3000);
  });

  it('should return next port after highest used port', () => {
    const config = makeConfig([
      { name: 'auth-service', port: 3000 },
      { name: 'bff-service', port: 3001 },
    ]);
    expect(getNextPort(config)).toBe(3002);
  });

  it('should skip services without ports (workers)', () => {
    const config = makeConfig([
      { name: 'auth-service', port: 3000 },
      { name: 'auth-worker' },
      { name: 'bff-service', port: 3001 },
    ]);
    expect(getNextPort(config)).toBe(3002);
  });

  it('should return 3000 when all services are workers (no ports)', () => {
    const config = makeConfig([{ name: 'worker-1' }, { name: 'worker-2' }]);
    expect(getNextPort(config)).toBe(3000);
  });

  it('should handle non-sequential ports', () => {
    const config = makeConfig([
      { name: 'auth-service', port: 3000 },
      { name: 'frontend', port: 3010 },
    ]);
    expect(getNextPort(config)).toBe(3011);
  });
});
