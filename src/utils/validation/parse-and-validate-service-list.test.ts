import { describe, it, expect } from '@rstest/core';
import { parseAndValidateServiceList } from './parse-and-validate-service-list';

describe('parseAndValidateServiceList', () => {
  const validServices = [
    'auth-service',
    'offers-service',
    'notifications-service',
  ];

  it('should parse comma-separated list', () => {
    const result = parseAndValidateServiceList(
      'auth-service,offers-service',
      validServices,
      'publishers',
    );
    expect(result).toEqual(['auth-service', 'offers-service']);
  });

  it('should trim whitespace', () => {
    const result = parseAndValidateServiceList(
      ' auth-service , offers-service ',
      validServices,
      'publishers',
    );
    expect(result).toEqual(['auth-service', 'offers-service']);
  });

  it('should filter empty strings', () => {
    const result = parseAndValidateServiceList(
      'auth-service,,offers-service,',
      validServices,
      'subscribers',
    );
    expect(result).toEqual(['auth-service', 'offers-service']);
  });

  it('should throw for invalid service name', () => {
    expect(() =>
      parseAndValidateServiceList(
        'auth-service,unknown-service',
        validServices,
        'publishers',
      ),
    ).toThrow('unknown-service');
  });

  it('should return single service', () => {
    const result = parseAndValidateServiceList(
      'auth-service',
      validServices,
      'publishers',
    );
    expect(result).toEqual(['auth-service']);
  });
});
