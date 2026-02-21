import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('../fs', () => ({
  readJsonFile: rs.fn(),
}));
rs.mock('../paths', () => ({
  findProjectRoot: rs.fn(),
}));

import { loadUserSecrets } from './load-user-secrets';
import { readJsonFile } from '../fs';
import { findProjectRoot } from '../paths';
import type { SecretsFile } from './types';

describe('loadUserSecrets', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  const mockSecrets: SecretsFile = {
    secrets: {
      STRIPE_KEY: 'sk_test_123',
      RESEND_API_KEY: 're_abc',
    },
  };

  describe('Standard use cases', () => {
    it('should load user secrets from project root', () => {
      rs.mocked(findProjectRoot).mockReturnValue('/project/root');
      rs.mocked(readJsonFile).mockReturnValue(mockSecrets);

      const result = loadUserSecrets();

      expect(result).toEqual(mockSecrets);
      expect(readJsonFile).toHaveBeenCalledWith(
        '/project/root/.secrets.user.json',
      );
    });

    it('should use provided rootDir', () => {
      rs.mocked(readJsonFile).mockReturnValue(mockSecrets);

      const result = loadUserSecrets('/custom/root');

      expect(result).toEqual(mockSecrets);
      expect(findProjectRoot).not.toHaveBeenCalled();
      expect(readJsonFile).toHaveBeenCalledWith(
        '/custom/root/.secrets.user.json',
      );
    });
  });

  describe('Edge cases', () => {
    it('should return null when file does not exist', () => {
      rs.mocked(findProjectRoot).mockReturnValue('/project/root');
      rs.mocked(readJsonFile).mockImplementation(() => {
        throw new Error('File not found');
      });

      const result = loadUserSecrets();

      expect(result).toBeNull();
    });

    it('should return null when file is invalid JSON', () => {
      rs.mocked(findProjectRoot).mockReturnValue('/project/root');
      rs.mocked(readJsonFile).mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

      const result = loadUserSecrets();

      expect(result).toBeNull();
    });
  });
});
