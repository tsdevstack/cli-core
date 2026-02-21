import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { validateServiceExistsInConfig } from './validate-service-exists-in-config';
import { CliError } from '../errors';

// Mock serviceExists
rs.mock('../config', () => ({
  serviceExists: rs.fn(),
}));

import { serviceExists } from '../config';

describe('validateServiceExistsInConfig', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should pass when service exists in config', () => {
    rs.mocked(serviceExists).mockReturnValue(true);

    expect(() => {
      validateServiceExistsInConfig('user-service');
    }).not.toThrow();

    expect(serviceExists).toHaveBeenCalledWith('user-service');
  });

  it('should throw CliError when service does not exist in config', () => {
    rs.mocked(serviceExists).mockReturnValue(false);

    expect(() => {
      validateServiceExistsInConfig('missing-service');
    }).toThrow(CliError);

    expect(() => {
      validateServiceExistsInConfig('missing-service');
    }).toThrow('Service "missing-service" not found in framework config');
  });

  it('should provide helpful context in error', () => {
    rs.mocked(serviceExists).mockReturnValue(false);

    try {
      validateServiceExistsInConfig('payment-service');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.context).toBe('Service not registered');
    }
  });

  it('should provide helpful hint in error', () => {
    rs.mocked(serviceExists).mockReturnValue(false);

    try {
      validateServiceExistsInConfig('auth-service');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.hint).toContain('.tsdevstack/config.json');
    }
  });
});
