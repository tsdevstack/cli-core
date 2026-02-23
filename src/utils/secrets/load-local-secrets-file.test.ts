import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { loadLocalSecretsFile } from './load-local-secrets-file';
import * as fsModule from '../fs';
import * as pathsModule from '../paths';
import { CliError } from '../errors';
import type { SecretsFile } from './types';

// Mock dependencies
rs.mock('../fs', { mock: true });
rs.mock('../paths', { mock: true });

describe('loadLocalSecretsFile', () => {
  const mockRootDir = '/test/project';

  beforeEach(() => {
    rs.clearAllMocks();
    rs.mocked(pathsModule.findProjectRoot).mockReturnValue(mockRootDir);
  });

  describe('Standard use cases', () => {
    it('should return the parsed secrets file', () => {
      const mockSecretsFile: SecretsFile = {
        secrets: {
          API_KEY: 'test-key-123',
        },
      };

      rs.mocked(fsModule.readJsonFile).mockReturnValue(mockSecretsFile);

      const result = loadLocalSecretsFile(mockRootDir);

      expect(result).toEqual(mockSecretsFile);
    });

    it('should construct correct file path', () => {
      rs.mocked(fsModule.readJsonFile).mockReturnValue({ secrets: {} });

      loadLocalSecretsFile('/custom/path');

      expect(fsModule.readJsonFile).toHaveBeenCalledWith(
        '/custom/path/.secrets.local.json',
      );
    });

    it('should use findProjectRoot when rootDir not provided', () => {
      rs.mocked(fsModule.readJsonFile).mockReturnValue({ secrets: {} });

      loadLocalSecretsFile();

      expect(pathsModule.findProjectRoot).toHaveBeenCalled();
      expect(fsModule.readJsonFile).toHaveBeenCalledWith(
        `${mockRootDir}/.secrets.local.json`,
      );
    });
  });

  describe('Error handling', () => {
    it('should throw CliError when file does not exist', () => {
      rs.mocked(fsModule.readJsonFile).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => loadLocalSecretsFile(mockRootDir)).toThrow(CliError);
    });

    it('should include helpful error message', () => {
      rs.mocked(fsModule.readJsonFile).mockImplementation(() => {
        throw new Error('File not found');
      });

      try {
        loadLocalSecretsFile(mockRootDir);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        const cliError = error as CliError;
        expect(cliError.message).toContain('.secrets.local.json');
      }
    });

    it('should throw CliError on invalid JSON', () => {
      rs.mocked(fsModule.readJsonFile).mockImplementation(() => {
        throw new SyntaxError('Unexpected token in JSON');
      });

      expect(() => loadLocalSecretsFile(mockRootDir)).toThrow(CliError);
    });
  });
});
