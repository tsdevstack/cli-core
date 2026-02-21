import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { validateServiceNameAvailable } from './validate-service-name-available';
import { CliError } from '../errors';

// Mock dependencies
rs.mock('./validate-service-name', () => ({
  validateServiceName: rs.fn(),
}));

rs.mock('../config', () => ({
  serviceExists: rs.fn(),
}));

rs.mock('../paths/index', () => ({
  getServicePath: rs.fn(),
}));

rs.mock('fs', () => ({
  existsSync: rs.fn(),
}));

import { validateServiceName } from './validate-service-name';
import { serviceExists } from '../config';
import { getServicePath } from '../paths/index';
import * as fs from 'fs';

describe('validateServiceNameAvailable', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should pass when service name is available', () => {
    rs.mocked(serviceExists).mockReturnValue(false);
    rs.mocked(getServicePath).mockReturnValue('/apps/new-service');
    rs.mocked(fs.existsSync).mockReturnValue(false);

    expect(() => {
      validateServiceNameAvailable('new-service');
    }).not.toThrow();

    expect(validateServiceName).toHaveBeenCalledWith('new-service');
    expect(serviceExists).toHaveBeenCalledWith('new-service');
    expect(getServicePath).toHaveBeenCalledWith('new-service');
    expect(fs.existsSync).toHaveBeenCalledWith('/apps/new-service');
  });

  it('should throw CliError when service name format is invalid', () => {
    rs.mocked(validateServiceName).mockImplementationOnce(() => {
      throw new CliError('Invalid service name format');
    });

    expect(() => {
      validateServiceNameAvailable('INVALID-SERVICE');
    }).toThrow(CliError);

    expect(validateServiceName).toHaveBeenCalledWith('INVALID-SERVICE');
    // Should not proceed to other checks
    expect(serviceExists).not.toHaveBeenCalled();
  });

  it('should throw CliError when service exists in config', () => {
    rs.mocked(serviceExists).mockReturnValue(true);

    expect(() => {
      validateServiceNameAvailable('existing-service');
    }).toThrow(CliError);

    expect(() => {
      validateServiceNameAvailable('existing-service');
    }).toThrow('already exists in framework config');
  });

  it('should provide helpful context when service exists in config', () => {
    rs.mocked(serviceExists).mockReturnValue(true);

    try {
      validateServiceNameAvailable('user-service');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.context).toBe('Service name unavailable');
      expect(cliError.hint).toContain('different service name');
    }
  });

  it('should throw CliError when service folder already exists', () => {
    rs.mocked(serviceExists).mockReturnValue(false);
    rs.mocked(getServicePath).mockReturnValue('/apps/payment-service');
    rs.mocked(fs.existsSync).mockReturnValue(true);

    expect(() => {
      validateServiceNameAvailable('payment-service');
    }).toThrow(CliError);

    expect(() => {
      validateServiceNameAvailable('payment-service');
    }).toThrow('Service folder already exists');
  });

  it('should include folder path in error when folder exists', () => {
    rs.mocked(serviceExists).mockReturnValue(false);
    rs.mocked(getServicePath).mockReturnValue('/apps/auth-service');
    rs.mocked(fs.existsSync).mockReturnValue(true);

    try {
      validateServiceNameAvailable('auth-service');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toContain('/apps/auth-service');
    }
  });

  it('should provide helpful hint when folder exists', () => {
    rs.mocked(serviceExists).mockReturnValue(false);
    rs.mocked(getServicePath).mockReturnValue('/apps/demo-service');
    rs.mocked(fs.existsSync).mockReturnValue(true);

    try {
      validateServiceNameAvailable('demo-service');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.hint).toContain('remove the existing folder');
    }
  });

  it('should check all validations in correct order', () => {
    const callOrder: string[] = [];

    rs.mocked(validateServiceName).mockImplementation(() => {
      callOrder.push('validateServiceName');
    });
    rs.mocked(serviceExists).mockImplementation(() => {
      callOrder.push('serviceExists');
      return false;
    });
    rs.mocked(getServicePath).mockImplementation(() => {
      callOrder.push('getServicePath');
      return '/apps/test-service';
    });
    rs.mocked(fs.existsSync).mockImplementation(() => {
      callOrder.push('existsSync');
      return false;
    });

    validateServiceNameAvailable('test-service');

    expect(callOrder).toEqual([
      'validateServiceName',
      'serviceExists',
      'getServicePath',
      'existsSync',
    ]);
  });
});
