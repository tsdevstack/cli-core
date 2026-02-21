import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { validateServicePackageJsonExists } from './validate-service-package-json-exists';
import { CliError } from '../errors';

// Mock dependencies
rs.mock('fs', () => ({
  existsSync: rs.fn(),
}));

rs.mock('../paths/index', () => ({
  getServicePackageJsonPath: rs.fn(),
}));

import * as fs from 'fs';
import { getServicePackageJsonPath } from '../paths/index';

describe('validateServicePackageJsonExists', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should pass when package.json exists', () => {
    rs.mocked(getServicePackageJsonPath).mockReturnValue(
      '/apps/user-service/package.json',
    );
    rs.mocked(fs.existsSync).mockReturnValue(true);

    expect(() => {
      validateServicePackageJsonExists('user-service');
    }).not.toThrow();

    expect(getServicePackageJsonPath).toHaveBeenCalledWith('user-service');
    expect(fs.existsSync).toHaveBeenCalledWith(
      '/apps/user-service/package.json',
    );
  });

  it('should throw CliError when package.json does not exist', () => {
    rs.mocked(getServicePackageJsonPath).mockReturnValue(
      '/apps/missing-service/package.json',
    );
    rs.mocked(fs.existsSync).mockReturnValue(false);

    expect(() => {
      validateServicePackageJsonExists('missing-service');
    }).toThrow(CliError);

    expect(() => {
      validateServicePackageJsonExists('missing-service');
    }).toThrow('package.json not found');
  });

  it('should include package.json path in error message', () => {
    rs.mocked(getServicePackageJsonPath).mockReturnValue(
      '/apps/payment-service/package.json',
    );
    rs.mocked(fs.existsSync).mockReturnValue(false);

    try {
      validateServicePackageJsonExists('payment-service');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toContain('/apps/payment-service/package.json');
    }
  });

  it('should provide helpful context and hint', () => {
    rs.mocked(getServicePackageJsonPath).mockReturnValue(
      '/apps/auth-service/package.json',
    );
    rs.mocked(fs.existsSync).mockReturnValue(false);

    try {
      validateServicePackageJsonExists('auth-service');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.context).toBe('Missing package.json');
      expect(cliError.hint).toContain('package.json');
    }
  });
});
