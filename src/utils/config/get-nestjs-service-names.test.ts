import { describe, it, expect } from '@rstest/core';
import { getNestjsServiceNames } from './get-nestjs-service-names';
import type { FrameworkService } from './types';

describe('getNestjsServiceNames', () => {
  it('should return only nestjs service names', () => {
    const services = [
      { name: 'auth-service', type: 'nestjs' },
      { name: 'frontend', type: 'nextjs' },
      { name: 'offers-service', type: 'nestjs' },
    ] as FrameworkService[];

    expect(getNestjsServiceNames(services)).toEqual([
      'auth-service',
      'offers-service',
    ]);
  });

  it('should return empty array when no nestjs services', () => {
    const services = [
      { name: 'frontend', type: 'nextjs' },
      { name: 'dashboard', type: 'spa' },
    ] as FrameworkService[];

    expect(getNestjsServiceNames(services)).toEqual([]);
  });

  it('should return empty array for empty input', () => {
    expect(getNestjsServiceNames([])).toEqual([]);
  });
});
