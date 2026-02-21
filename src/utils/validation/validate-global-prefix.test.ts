import { describe, it, expect, rs } from '@rstest/core';
import { validateGlobalPrefix } from './validate-global-prefix';
import { CliError } from '../errors';

// Mock validateServiceName
rs.mock('./validate-service-name', () => ({
  validateServiceName: rs.fn(),
}));

import { validateServiceName } from './validate-service-name';

describe('validateGlobalPrefix', () => {
  it('should pass for valid non-reserved prefix', () => {
    expect(() => {
      validateGlobalPrefix('user');
    }).not.toThrow();

    expect(validateServiceName).toHaveBeenCalledWith('user');
  });

  it('should pass for valid service-like prefix', () => {
    expect(() => {
      validateGlobalPrefix('payment');
    }).not.toThrow();

    expect(validateServiceName).toHaveBeenCalledWith('payment');
  });

  it('should throw CliError for reserved prefix "api"', () => {
    expect(() => {
      validateGlobalPrefix('api');
    }).toThrow(CliError);

    expect(() => {
      validateGlobalPrefix('api');
    }).toThrow('Global prefix "api" is reserved.');
  });

  it('should throw CliError for reserved prefix "admin"', () => {
    expect(() => {
      validateGlobalPrefix('admin');
    }).toThrow(CliError);

    expect(() => {
      validateGlobalPrefix('admin');
    }).toThrow('Global prefix "admin" is reserved.');
  });

  it('should throw CliError for reserved prefix "health"', () => {
    expect(() => {
      validateGlobalPrefix('health');
    }).toThrow(CliError);
  });

  it('should list all reserved prefixes in error message', () => {
    try {
      validateGlobalPrefix('api');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toContain('Reserved prefixes:');
      expect(cliError.message).toContain('api');
      expect(cliError.message).toContain('admin');
      expect(cliError.message).toContain('health');
    }
  });

  it('should call validateServiceName first for basic validation', () => {
    rs.mocked(validateServiceName).mockImplementationOnce(() => {
      throw new CliError('Invalid name format');
    });

    expect(() => {
      validateGlobalPrefix('INVALID');
    }).toThrow(CliError);

    expect(validateServiceName).toHaveBeenCalledWith('INVALID');
  });
});
