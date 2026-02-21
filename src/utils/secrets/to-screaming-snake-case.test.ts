import { describe, it, expect } from '@rstest/core';
import { toScreamingSnakeCase } from './to-screaming-snake-case';

describe('toScreamingSnakeCase', () => {
  describe('Standard kebab-case conversions', () => {
    it('should convert single-word kebab-case to uppercase', () => {
      expect(toScreamingSnakeCase('service')).toBe('SERVICE');
    });

    it('should convert two-word kebab-case to SCREAMING_SNAKE_CASE', () => {
      expect(toScreamingSnakeCase('auth-service')).toBe('AUTH_SERVICE');
    });

    it('should convert multi-word kebab-case to SCREAMING_SNAKE_CASE', () => {
      expect(toScreamingSnakeCase('user-auth-service')).toBe(
        'USER_AUTH_SERVICE',
      );
    });

    it('should convert complex service names', () => {
      expect(toScreamingSnakeCase('my-complex-service-name')).toBe(
        'MY_COMPLEX_SERVICE_NAME',
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle single character', () => {
      expect(toScreamingSnakeCase('a')).toBe('A');
    });

    it('should handle single dash', () => {
      expect(toScreamingSnakeCase('a-b')).toBe('A_B');
    });

    it('should handle multiple consecutive dashes', () => {
      expect(toScreamingSnakeCase('a--b')).toBe('A__B');
    });

    it('should handle leading dash', () => {
      expect(toScreamingSnakeCase('-service')).toBe('_SERVICE');
    });

    it('should handle trailing dash', () => {
      expect(toScreamingSnakeCase('service-')).toBe('SERVICE_');
    });

    it('should handle empty string', () => {
      expect(toScreamingSnakeCase('')).toBe('');
    });
  });

  describe('Numbers in service names', () => {
    it('should preserve numbers in conversion', () => {
      expect(toScreamingSnakeCase('api-v2')).toBe('API_V2');
    });

    it('should handle numbers at start', () => {
      expect(toScreamingSnakeCase('2-api')).toBe('2_API');
    });

    it('should handle numbers in middle', () => {
      expect(toScreamingSnakeCase('api-v2-service')).toBe('API_V2_SERVICE');
    });

    it('should handle only numbers', () => {
      expect(toScreamingSnakeCase('123')).toBe('123');
    });
  });

  describe('Already uppercase input', () => {
    it('should handle already uppercase single word', () => {
      expect(toScreamingSnakeCase('SERVICE')).toBe('SERVICE');
    });

    it('should handle already uppercase with dashes', () => {
      expect(toScreamingSnakeCase('AUTH-SERVICE')).toBe('AUTH_SERVICE');
    });

    it('should handle mixed case', () => {
      expect(toScreamingSnakeCase('Auth-Service')).toBe('AUTH_SERVICE');
    });
  });

  describe('Special characters (should only replace dashes)', () => {
    it('should only replace dashes, not other special chars', () => {
      expect(toScreamingSnakeCase('api_service')).toBe('API_SERVICE');
    });

    it('should handle dots by keeping them', () => {
      expect(toScreamingSnakeCase('api.service')).toBe('API.SERVICE');
    });
  });

  describe('Real-world service name examples', () => {
    it('should convert frontend service name', () => {
      expect(toScreamingSnakeCase('frontend')).toBe('FRONTEND');
    });

    it('should convert auth-service', () => {
      expect(toScreamingSnakeCase('auth-service')).toBe('AUTH_SERVICE');
    });

    it('should convert user-management-api', () => {
      expect(toScreamingSnakeCase('user-management-api')).toBe(
        'USER_MANAGEMENT_API',
      );
    });

    it('should convert demo-service', () => {
      expect(toScreamingSnakeCase('demo-service')).toBe('DEMO_SERVICE');
    });

    it('should convert test-service', () => {
      expect(toScreamingSnakeCase('test-service')).toBe('TEST_SERVICE');
    });

    it('should convert example-service', () => {
      expect(toScreamingSnakeCase('example-service')).toBe('EXAMPLE_SERVICE');
    });
  });
});
