import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('../fs', () => ({
  writeJsonFile: rs.fn(),
}));
rs.mock('../paths', () => ({
  findProjectRoot: rs.fn(),
}));

import { writeSecretsFile } from './write-secrets-file';
import { writeJsonFile } from '../fs';
import { findProjectRoot } from '../paths';
import type { SecretsFile } from './types';

describe('writeSecretsFile', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  const mockSecrets: SecretsFile = {
    secrets: {
      JWT_SECRET: 'abc123',
      API_KEY: 'key456',
    },
  };

  describe('Standard use cases', () => {
    it('should write secrets file to project root', () => {
      rs.mocked(findProjectRoot).mockReturnValue('/project/root');

      writeSecretsFile('.secrets.tsdevstack.json', mockSecrets);

      expect(writeJsonFile).toHaveBeenCalledWith(
        '/project/root/.secrets.tsdevstack.json',
        mockSecrets,
      );
    });

    it('should use provided rootDir instead of findProjectRoot', () => {
      writeSecretsFile('.secrets.user.json', mockSecrets, '/custom/root');

      expect(findProjectRoot).not.toHaveBeenCalled();
      expect(writeJsonFile).toHaveBeenCalledWith(
        '/custom/root/.secrets.user.json',
        mockSecrets,
      );
    });
  });

  describe('Edge cases', () => {
    it('should call findProjectRoot when rootDir is not provided', () => {
      rs.mocked(findProjectRoot).mockReturnValue('/default/root');

      writeSecretsFile('.secrets.json', mockSecrets);

      expect(findProjectRoot).toHaveBeenCalled();
      expect(writeJsonFile).toHaveBeenCalledWith(
        '/default/root/.secrets.json',
        mockSecrets,
      );
    });
  });
});
