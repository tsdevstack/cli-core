import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { validateFolderNameMatchesService } from './validate-folder-name-matches-service';
import { CliError } from '../errors';

// Mock the paths module
rs.mock('../paths/index', () => ({
  getServicePath: rs.fn(),
}));

import { getServicePath } from '../paths/index';

describe('validateFolderNameMatchesService', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should pass when folder name matches service name', () => {
    rs.mocked(getServicePath).mockReturnValue('/root/apps/auth-service');

    expect(() => {
      validateFolderNameMatchesService('auth-service');
    }).not.toThrow();

    expect(getServicePath).toHaveBeenCalledWith('auth-service');
  });

  it('should throw CliError when folder name does not match service name', () => {
    rs.mocked(getServicePath).mockReturnValue('/root/apps/wrong-folder');

    expect(() => {
      validateFolderNameMatchesService('auth-service');
    }).toThrow(CliError);

    expect(() => {
      validateFolderNameMatchesService('auth-service');
    }).toThrow(
      'Folder name "wrong-folder" does not match service name "auth-service"',
    );
  });

  it('should provide helpful error context and hint', () => {
    rs.mocked(getServicePath).mockReturnValue('/root/apps/old-name');

    try {
      validateFolderNameMatchesService('new-name');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toBe(
        'Folder name "old-name" does not match service name "new-name"',
      );
      expect(cliError.context).toBe('Folder name mismatch');
      expect(cliError.hint).toBe(
        'Rename the folder to "new-name" or update the service name to "old-name"',
      );
    }
  });
});
