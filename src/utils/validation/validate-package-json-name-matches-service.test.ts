import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { validatePackageJsonNameMatchesService } from './validate-package-json-name-matches-service';
import { CliError } from '../errors';

// Mock dependencies
rs.mock('../paths/index', () => ({
  getServicePath: rs.fn(),
}));

rs.mock('../fs/index', () => ({
  readPackageJsonFrom: rs.fn(),
}));

import { getServicePath } from '../paths/index';
import { readPackageJsonFrom } from '../fs/index';

describe('validatePackageJsonNameMatchesService', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should pass when package.json name matches service name', () => {
    rs.mocked(getServicePath).mockReturnValue('/services/user-service');
    rs.mocked(readPackageJsonFrom).mockReturnValue({ name: 'user-service' });

    expect(() => {
      validatePackageJsonNameMatchesService('user-service');
    }).not.toThrow();

    expect(getServicePath).toHaveBeenCalledWith('user-service');
    expect(readPackageJsonFrom).toHaveBeenCalledWith('/services/user-service');
  });

  it('should throw CliError when package.json name does not match service name', () => {
    rs.mocked(getServicePath).mockReturnValue('/services/user-service');
    rs.mocked(readPackageJsonFrom).mockReturnValue({ name: 'wrong-name' });

    expect(() => {
      validatePackageJsonNameMatchesService('user-service');
    }).toThrow(CliError);

    expect(() => {
      validatePackageJsonNameMatchesService('user-service');
    }).toThrow('Package name mismatch');
  });

  it('should include both folder and package.json names in error message', () => {
    rs.mocked(getServicePath).mockReturnValue('/services/payment-service');
    rs.mocked(readPackageJsonFrom).mockReturnValue({ name: 'old-payment' });

    try {
      validatePackageJsonNameMatchesService('payment-service');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toContain(
        'Folder name:       "payment-service"',
      );
      expect(cliError.message).toContain('package.json name: "old-payment"');
    }
  });

  it('should provide helpful hint in error', () => {
    rs.mocked(getServicePath).mockReturnValue('/services/auth-service');
    rs.mocked(readPackageJsonFrom).mockReturnValue({ name: 'authentication' });

    try {
      validatePackageJsonNameMatchesService('auth-service');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.hint).toBe(
        'Update package.json name to match the folder name, or rename the folder',
      );
    }
  });
});
