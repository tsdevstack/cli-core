import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { validateServiceFolderExists } from './validate-service-folder-exists';
import { CliError } from '../errors';

// Mock dependencies
rs.mock('fs', () => ({
  existsSync: rs.fn(),
}));

rs.mock('../paths/index', () => ({
  getServicePath: rs.fn(),
}));

import * as fs from 'fs';
import { getServicePath } from '../paths/index';

describe('validateServiceFolderExists', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should pass when service folder exists', () => {
    rs.mocked(getServicePath).mockReturnValue('/apps/user-service');
    rs.mocked(fs.existsSync).mockReturnValue(true);

    expect(() => {
      validateServiceFolderExists('user-service');
    }).not.toThrow();

    expect(getServicePath).toHaveBeenCalledWith('user-service');
    expect(fs.existsSync).toHaveBeenCalledWith('/apps/user-service');
  });

  it('should throw CliError when service folder does not exist', () => {
    rs.mocked(getServicePath).mockReturnValue('/apps/missing-service');
    rs.mocked(fs.existsSync).mockReturnValue(false);

    expect(() => {
      validateServiceFolderExists('missing-service');
    }).toThrow(CliError);

    expect(() => {
      validateServiceFolderExists('missing-service');
    }).toThrow('Service folder not found');
  });

  it('should include service path in error message', () => {
    rs.mocked(getServicePath).mockReturnValue('/apps/payment-service');
    rs.mocked(fs.existsSync).mockReturnValue(false);

    try {
      validateServiceFolderExists('payment-service');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toContain('/apps/payment-service');
    }
  });

  it('should provide helpful context and hint', () => {
    rs.mocked(getServicePath).mockReturnValue('/apps/auth-service');
    rs.mocked(fs.existsSync).mockReturnValue(false);

    try {
      validateServiceFolderExists('auth-service');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.context).toBe('Service folder missing');
      expect(cliError.hint).toContain('apps/');
    }
  });
});
