import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockReadJsonFile, mockGetCredentialsPath } = rs.hoisted(() => ({
  mockReadJsonFile: rs.fn(),
  mockGetCredentialsPath: rs.fn(),
}));

rs.mock('../fs', () => ({
  readJsonFile: mockReadJsonFile,
}));
rs.mock('../paths/get-credentials-path', () => ({
  getCredentialsPath: mockGetCredentialsPath,
}));

import { loadCredentialsFile } from './load-credentials-file';

describe('loadCredentialsFile', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should load credentials for GCP', () => {
      const mockCreds = {
        dev: { project_id: 'my-dev', region: 'us-central1' },
      };
      mockGetCredentialsPath.mockReturnValue(
        '/project/.tsdevstack/.credentials.gcp.json',
      );
      mockReadJsonFile.mockReturnValue(mockCreds);

      const result = loadCredentialsFile('/project', 'gcp');

      expect(result).toEqual(mockCreds);
      expect(mockGetCredentialsPath).toHaveBeenCalledWith('/project', 'gcp');
      expect(mockReadJsonFile).toHaveBeenCalledWith(
        '/project/.tsdevstack/.credentials.gcp.json',
      );
    });

    it('should load credentials for AWS', () => {
      const mockCreds = {
        dev: { accountId: '123456789', region: 'us-east-1' },
      };
      mockGetCredentialsPath.mockReturnValue(
        '/project/.tsdevstack/.credentials.aws.json',
      );
      mockReadJsonFile.mockReturnValue(mockCreds);

      const result = loadCredentialsFile('/project', 'aws');

      expect(result).toEqual(mockCreds);
      expect(mockGetCredentialsPath).toHaveBeenCalledWith('/project', 'aws');
    });

    it('should load credentials for Azure', () => {
      const mockCreds = {
        dev: { subscriptionId: 'sub-123', location: 'eastus' },
      };
      mockGetCredentialsPath.mockReturnValue(
        '/project/.tsdevstack/.credentials.azure.json',
      );
      mockReadJsonFile.mockReturnValue(mockCreds);

      const result = loadCredentialsFile('/project', 'azure');

      expect(result).toEqual(mockCreds);
      expect(mockGetCredentialsPath).toHaveBeenCalledWith('/project', 'azure');
    });
  });

  describe('Error handling', () => {
    it('should throw error when credentials file not found', () => {
      mockGetCredentialsPath.mockReturnValue(
        '/project/.tsdevstack/.credentials.gcp.json',
      );
      mockReadJsonFile.mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => loadCredentialsFile('/project', 'gcp')).toThrow(
        'Failed to load credentials file for gcp',
      );
    });

    it('should include original error message', () => {
      mockGetCredentialsPath.mockReturnValue(
        '/project/.tsdevstack/.credentials.aws.json',
      );
      mockReadJsonFile.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      expect(() => loadCredentialsFile('/project', 'aws')).toThrow(
        'EACCES: permission denied',
      );
    });

    it('should handle non-Error thrown values', () => {
      mockGetCredentialsPath.mockReturnValue(
        '/project/.tsdevstack/.credentials.gcp.json',
      );
      mockReadJsonFile.mockImplementation(() => {
        throw 'string error';
      });

      expect(() => loadCredentialsFile('/project', 'gcp')).toThrow(
        'string error',
      );
    });
  });
});
