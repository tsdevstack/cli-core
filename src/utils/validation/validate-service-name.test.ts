import { describe, it, expect } from '@rstest/core';
import { validateServiceName } from './validate-service-name';
import { CliError } from '../errors';

describe('validateServiceName', () => {
  describe('valid service names', () => {
    it('should pass for valid service names', () => {
      expect(() => validateServiceName('user-service')).not.toThrow();
      expect(() => validateServiceName('auth-service')).not.toThrow();
      expect(() => validateServiceName('payment-v2-service')).not.toThrow();
      expect(() =>
        validateServiceName('user-management-service'),
      ).not.toThrow();
      expect(() => validateServiceName('ab')).not.toThrow(); // minimum length
    });

    it('should pass for names with numbers', () => {
      expect(() => validateServiceName('auth2-service')).not.toThrow();
      expect(() => validateServiceName('payment-v2')).not.toThrow();
    });
  });

  describe('uppercase letters', () => {
    it('should throw for names with uppercase letters', () => {
      expect(() => validateServiceName('User-service')).toThrow(CliError);
      expect(() => validateServiceName('USER-SERVICE')).toThrow(CliError);
      expect(() => validateServiceName('userService')).toThrow(CliError);
    });

    it('should provide helpful error message for uppercase', () => {
      try {
        validateServiceName('Auth-Service');
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('uppercase letters');
        expect(cliError.message).toContain('must be all lowercase');
      }
    });
  });

  describe('invalid characters', () => {
    it('should throw for names with underscores', () => {
      expect(() => validateServiceName('user_service')).toThrow(CliError);
    });

    it('should throw for names with special characters', () => {
      expect(() => validateServiceName('user@service')).toThrow(CliError);
      expect(() => validateServiceName('user.service')).toThrow(CliError);
      expect(() => validateServiceName('user service')).toThrow(CliError);
    });

    it('should suggest using hyphens instead of underscores', () => {
      try {
        validateServiceName('user_service');
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('hyphens instead of underscores');
      }
    });
  });

  describe('must start with letter', () => {
    it('should throw for names starting with number', () => {
      expect(() => validateServiceName('1user-service')).toThrow(CliError);
      expect(() => validateServiceName('123service')).toThrow(CliError);
    });

    it('should throw for names starting with hyphen', () => {
      expect(() => validateServiceName('-user-service')).toThrow(CliError);
    });

    it('should provide helpful error message', () => {
      try {
        validateServiceName('9auth-service');
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('must start with a letter');
      }
    });
  });

  describe('cannot start or end with hyphen', () => {
    it('should throw for names starting with hyphen', () => {
      expect(() => validateServiceName('-user-service')).toThrow(CliError);
    });

    it('should throw for names ending with hyphen', () => {
      expect(() => validateServiceName('user-service-')).toThrow(CliError);
    });

    it('should provide helpful error message', () => {
      try {
        validateServiceName('user-service-');
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('cannot start or end with a hyphen');
      }
    });
  });

  describe('reserved infrastructure names', () => {
    it('should throw for reserved names', () => {
      expect(() => validateServiceName('gateway')).toThrow(CliError);
      expect(() => validateServiceName('kong')).toThrow(CliError);
      expect(() => validateServiceName('redis')).toThrow(CliError);
      expect(() => validateServiceName('postgres')).toThrow(CliError);
      expect(() => validateServiceName('postgresql')).toThrow(CliError);
      expect(() => validateServiceName('mysql')).toThrow(CliError);
      expect(() => validateServiceName('mongodb')).toThrow(CliError);
    });

    it('should throw for reserved names with -service suffix', () => {
      expect(() => validateServiceName('gateway-service')).toThrow(CliError);
      expect(() => validateServiceName('kong-service')).toThrow(CliError);
      expect(() => validateServiceName('redis-service')).toThrow(CliError);
    });

    it('should list all reserved names in error', () => {
      try {
        validateServiceName('gateway-service');
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('reserved for infrastructure');
        expect(cliError.message).toContain('gateway');
        expect(cliError.message).toContain('kong');
        expect(cliError.message).toContain('redis');
      }
    });
  });

  describe('cannot end with -db', () => {
    it('should throw for names ending with -db', () => {
      expect(() => validateServiceName('user-db')).toThrow(CliError);
      expect(() => validateServiceName('payment-db')).toThrow(CliError);
    });

    it('should throw for names ending with -db-service', () => {
      expect(() => validateServiceName('auth-db-service')).toThrow(CliError);
      expect(() => validateServiceName('user-db-service')).toThrow(CliError);
    });

    it('should suggest correct alternative for name without -service suffix', () => {
      try {
        validateServiceName('auth-db');
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('reserved for database containers');
        expect(cliError.message).toContain('Suggested: "auth-service"');
      }
    });

    it('should suggest correct alternative for name with -service suffix', () => {
      try {
        validateServiceName('payment-db-service');
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('reserved for database containers');
        expect(cliError.message).toContain('Suggested: "payment-service"');
      }
    });
  });

  describe('length validation', () => {
    it('should throw for names that are too short', () => {
      expect(() => validateServiceName('a')).toThrow(CliError);
    });

    it('should throw for names that are too long', () => {
      const longName = 'a'.repeat(41); // 41 characters
      expect(() => validateServiceName(longName)).toThrow(CliError);
    });

    it('should provide length details in error message for too short', () => {
      try {
        validateServiceName('a');
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('too short');
        expect(cliError.message).toContain('1 characters');
        expect(cliError.message).toContain('Minimum: 2');
      }
    });

    it('should provide length details in error message for too long', () => {
      const longName = 'a'.repeat(41);
      try {
        validateServiceName(longName);
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('too long');
        expect(cliError.message).toContain('41 characters');
        expect(cliError.message).toContain('Maximum: 40');
        expect(cliError.message).toContain('PostgreSQL');
      }
    });

    it('should pass for names at exact max length', () => {
      const maxLengthName = 'a'.repeat(40); // exactly 40 characters
      expect(() => validateServiceName(maxLengthName)).not.toThrow();
    });
  });
});
