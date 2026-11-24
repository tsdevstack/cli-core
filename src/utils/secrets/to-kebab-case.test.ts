import { describe, it, expect } from '@rstest/core';
import { toKebabCase } from './to-kebab-case';
import { KONG_RUNTIME_SECRETS } from '../../constants';

describe('toKebabCase', () => {
  describe('Standard use cases', () => {
    it('should convert a SCREAMING_SNAKE_CASE key', () => {
      expect(toKebabCase('REDIS_PASSWORD')).toBe('redis-password');
    });

    it('should convert a single word', () => {
      expect(toKebabCase('DOMAIN')).toBe('domain');
    });

    it('should keep digits in place', () => {
      expect(toKebabCase('STRIPE_KEY_2')).toBe('stripe-key-2');
    });

    it('should convert every Kong runtime secret', () => {
      expect(KONG_RUNTIME_SECRETS.map((key) => toKebabCase(key))).toEqual([
        'redis-password',
        'kong-trust-token',
        'kong-frontend-token',
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should handle an empty string', () => {
      expect(toKebabCase('')).toBe('');
    });

    it('should convert consecutive underscores', () => {
      expect(toKebabCase('NEXT__FOO')).toBe('next--foo');
    });

    it('should convert leading and trailing underscores', () => {
      expect(toKebabCase('_PRIVATE')).toBe('-private');
      expect(toKebabCase('VALUE_')).toBe('value-');
    });
  });

  describe('Same result as the plain conversion', () => {
    const inputs = [
      'REDIS_PASSWORD',
      'KONG_TRUST_TOKEN',
      'STRIPE_KEY_2',
      'NEXT__FOO',
      '_PRIVATE',
      'VALUE_',
      '1ST_PLACE',
      'MIXED-AND_SEPARATORS',
      'camelCase',
      'already-kebab',
      'A.B',
    ];

    it.each(inputs)('should convert %j like the plain conversion', (input) => {
      expect(toKebabCase(input)).toBe(input.toLowerCase().replace(/_/g, '-'));
    });
  });
});
