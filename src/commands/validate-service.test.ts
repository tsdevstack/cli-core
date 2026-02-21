import { describe, it, expect, rs, beforeEach } from '@rstest/core';

// Mock dependencies BEFORE imports
rs.mock('../utils/validation', () => ({
  validateServiceComplete: rs.fn(),
}));

rs.mock('../utils/service/resolve-service-name-interactive', () => ({
  resolveServiceNameInteractive: rs.fn(),
}));

rs.mock('../utils/logger', () => ({
  logger: {
    success: rs.fn(),
    info: rs.fn(),
    validating: rs.fn(),
  },
}));

import { validateService } from './validate-service';
import { validateServiceComplete } from '../utils/validation';
import { resolveServiceNameInteractive } from '../utils/service/resolve-service-name-interactive';
import { logger } from '../utils/logger';

describe('validateService', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should resolve service name via resolveServiceNameInteractive', async () => {
      rs.mocked(resolveServiceNameInteractive).mockResolvedValue(
        'auth-service',
      );

      await validateService('auth-service');

      expect(resolveServiceNameInteractive).toHaveBeenCalledWith(
        'auth-service',
      );
    });

    it('should call validateServiceComplete with resolved name and true', async () => {
      rs.mocked(resolveServiceNameInteractive).mockResolvedValue(
        'auth-service',
      );

      await validateService('auth-service');

      expect(validateServiceComplete).toHaveBeenCalledWith(
        'auth-service',
        true,
      );
    });

    it('should log success message with service name', async () => {
      rs.mocked(resolveServiceNameInteractive).mockResolvedValue(
        'offers-service',
      );

      await validateService('offers-service');

      expect(logger.success).toHaveBeenCalledWith(
        'Service "offers-service" is valid',
      );
    });

    it('should log all check items', async () => {
      rs.mocked(resolveServiceNameInteractive).mockResolvedValue(
        'auth-service',
      );

      await validateService('auth-service');

      expect(logger.info).toHaveBeenCalledWith('   All checks passed:');
      expect(logger.validating).toHaveBeenCalledWith(
        '   Service name format is valid',
      );
      expect(logger.validating).toHaveBeenCalledWith(
        '   Service is registered in config',
      );
      expect(logger.validating).toHaveBeenCalledWith(
        '   Service folder exists',
      );
      expect(logger.validating).toHaveBeenCalledWith('   package.json exists');
      expect(logger.validating).toHaveBeenCalledWith(
        '   Folder name matches service name',
      );
      expect(logger.validating).toHaveBeenCalledWith(
        '   package.json name matches service name',
      );
    });

    it('should work with provided service name', async () => {
      rs.mocked(resolveServiceNameInteractive).mockResolvedValue('bff-service');

      await validateService('bff-service');

      expect(resolveServiceNameInteractive).toHaveBeenCalledWith('bff-service');
      expect(validateServiceComplete).toHaveBeenCalledWith('bff-service', true);
      expect(logger.success).toHaveBeenCalledWith(
        'Service "bff-service" is valid',
      );
    });

    it('should work with undefined service name (interactive)', async () => {
      rs.mocked(resolveServiceNameInteractive).mockResolvedValue(
        'auth-service',
      );

      await validateService(undefined);

      expect(resolveServiceNameInteractive).toHaveBeenCalledWith(undefined);
      expect(validateServiceComplete).toHaveBeenCalledWith(
        'auth-service',
        true,
      );
      expect(logger.success).toHaveBeenCalledWith(
        'Service "auth-service" is valid',
      );
    });
  });

  describe('Error handling', () => {
    it('should throw when validateServiceComplete throws', async () => {
      rs.mocked(resolveServiceNameInteractive).mockResolvedValue(
        'invalid-service',
      );
      rs.mocked(validateServiceComplete).mockImplementation(() => {
        throw new Error('Validation failed: service not found');
      });

      await expect(validateService('invalid-service')).rejects.toThrow(
        'Validation failed: service not found',
      );

      expect(resolveServiceNameInteractive).toHaveBeenCalledWith(
        'invalid-service',
      );
      expect(validateServiceComplete).toHaveBeenCalledWith(
        'invalid-service',
        true,
      );
      // Should not log success when validation fails
      expect(logger.success).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should throw when resolveServiceNameInteractive throws', async () => {
      rs.mocked(resolveServiceNameInteractive).mockRejectedValue(
        new Error('Failed to resolve service name'),
      );

      await expect(validateService('nonexistent')).rejects.toThrow(
        'Failed to resolve service name',
      );

      expect(resolveServiceNameInteractive).toHaveBeenCalledWith('nonexistent');
      // Should not proceed to validation or logging
      expect(validateServiceComplete).not.toHaveBeenCalled();
      expect(logger.success).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });
  });
});
