import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { validateServiceComplete } from './validate-service-complete';
import { CliError } from '../errors';

// Mock all validation functions
rs.mock('./validate-service-name', () => ({
  validateServiceName: rs.fn(),
}));

rs.mock('./validate-service-exists-in-config', () => ({
  validateServiceExistsInConfig: rs.fn(),
}));

rs.mock('./validate-service-folder-exists', () => ({
  validateServiceFolderExists: rs.fn(),
}));

rs.mock('./validate-service-package-json-exists', () => ({
  validateServicePackageJsonExists: rs.fn(),
}));

rs.mock('./validate-folder-name-matches-service', () => ({
  validateFolderNameMatchesService: rs.fn(),
}));

rs.mock('./validate-package-json-name-matches-service', () => ({
  validatePackageJsonNameMatchesService: rs.fn(),
}));

import { validateServiceName } from './validate-service-name';
import { validateServiceExistsInConfig } from './validate-service-exists-in-config';
import { validateServiceFolderExists } from './validate-service-folder-exists';
import { validateServicePackageJsonExists } from './validate-service-package-json-exists';
import { validateFolderNameMatchesService } from './validate-folder-name-matches-service';
import { validatePackageJsonNameMatchesService } from './validate-package-json-name-matches-service';

describe('validateServiceComplete', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('fail-fast mode (collectErrors = false)', () => {
    it('should pass when all validations pass', () => {
      expect(() => {
        validateServiceComplete('user-service', false);
      }).not.toThrow();

      expect(validateServiceName).toHaveBeenCalledWith('user-service');
      expect(validateServiceExistsInConfig).toHaveBeenCalledWith(
        'user-service',
      );
      expect(validateServiceFolderExists).toHaveBeenCalledWith('user-service');
      expect(validateServicePackageJsonExists).toHaveBeenCalledWith(
        'user-service',
      );
      expect(validateFolderNameMatchesService).toHaveBeenCalledWith(
        'user-service',
      );
      expect(validatePackageJsonNameMatchesService).toHaveBeenCalledWith(
        'user-service',
      );
    });

    it('should pass when all validations pass (default mode)', () => {
      expect(() => {
        validateServiceComplete('user-service');
      }).not.toThrow();
    });

    it('should throw immediately on first validation failure', () => {
      rs.mocked(validateServiceName).mockImplementationOnce(() => {
        throw new CliError('Invalid service name');
      });

      expect(() => {
        validateServiceComplete('INVALID-SERVICE');
      }).toThrow(CliError);

      expect(validateServiceName).toHaveBeenCalled();
      // Should not call subsequent validations
      expect(validateServiceExistsInConfig).not.toHaveBeenCalled();
    });

    it('should throw immediately on later validation failure', () => {
      rs.mocked(validateServiceFolderExists).mockImplementationOnce(() => {
        throw new CliError('Service folder does not exist');
      });

      expect(() => {
        validateServiceComplete('user-service');
      }).toThrow(CliError);

      expect(validateServiceName).toHaveBeenCalled();
      expect(validateServiceExistsInConfig).toHaveBeenCalled();
      expect(validateServiceFolderExists).toHaveBeenCalled();
      // Should not call subsequent validations
      expect(validateServicePackageJsonExists).not.toHaveBeenCalled();
    });
  });

  describe('collect errors mode (collectErrors = true)', () => {
    it('should pass when all validations pass', () => {
      expect(() => {
        validateServiceComplete('user-service', true);
      }).not.toThrow();

      expect(validateServiceName).toHaveBeenCalledWith('user-service');
      expect(validateServiceExistsInConfig).toHaveBeenCalledWith(
        'user-service',
      );
      expect(validateServiceFolderExists).toHaveBeenCalledWith('user-service');
      expect(validateServicePackageJsonExists).toHaveBeenCalledWith(
        'user-service',
      );
      expect(validateFolderNameMatchesService).toHaveBeenCalledWith(
        'user-service',
      );
      expect(validatePackageJsonNameMatchesService).toHaveBeenCalledWith(
        'user-service',
      );
    });

    it('should collect single validation error', () => {
      rs.mocked(validateServiceName).mockImplementationOnce(() => {
        throw new CliError('Invalid service name');
      });

      try {
        validateServiceComplete('INVALID-SERVICE', true);
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('1. Invalid service name');
        expect(cliError.context).toContain('1 error(s)');
      }

      // Should call all validations even after first failure
      expect(validateServiceName).toHaveBeenCalled();
      expect(validateServiceExistsInConfig).toHaveBeenCalled();
      expect(validateServiceFolderExists).toHaveBeenCalled();
      expect(validateServicePackageJsonExists).toHaveBeenCalled();
      expect(validateFolderNameMatchesService).toHaveBeenCalled();
      expect(validatePackageJsonNameMatchesService).toHaveBeenCalled();
    });

    it('should collect multiple validation errors', () => {
      rs.mocked(validateServiceName).mockImplementationOnce(() => {
        throw new CliError('Invalid service name');
      });

      rs.mocked(validateServiceFolderExists).mockImplementationOnce(() => {
        throw new CliError('Service folder does not exist');
      });

      rs.mocked(validatePackageJsonNameMatchesService).mockImplementationOnce(
        () => {
          throw new CliError('Package name mismatch');
        },
      );

      try {
        validateServiceComplete('broken-service', true);
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('1. Invalid service name');
        expect(cliError.message).toContain('2. Service folder does not exist');
        expect(cliError.message).toContain('3. Package name mismatch');
        expect(cliError.context).toContain('3 error(s)');
      }
    });

    it('should provide helpful hint in collected errors', () => {
      rs.mocked(validateServiceName).mockImplementationOnce(() => {
        throw new CliError('Invalid service name');
      });

      try {
        validateServiceComplete('INVALID', true);
        expect.fail('Should have thrown CliError');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.hint).toBe(
          'Fix all issues above and run validation again',
        );
      }
    });
  });
});
