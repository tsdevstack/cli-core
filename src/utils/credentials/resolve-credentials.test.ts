import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';
import { resolveCredentials } from './resolve-credentials';

// Mock dependencies
rs.mock('../ci/is-ci', () => ({
  isCIEnv: rs.fn(),
}));

rs.mock('./load-credentials-file', () => ({
  loadCredentialsFile: rs.fn(),
}));

rs.mock('../paths/find-project-root', () => ({
  findProjectRoot: rs.fn(),
}));

import { isCIEnv } from '../ci/is-ci';
import { loadCredentialsFile } from './load-credentials-file';
import { findProjectRoot } from '../paths/find-project-root';

describe('resolveCredentials', () => {
  const mockCredentials = {
    project_id: 'test-project-123',
    client_email: 'test@test-project-123.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
    region: 'us-central1',
  };

  beforeEach(() => {
    rs.clearAllMocks();
    rs.mocked(findProjectRoot).mockReturnValue('/test/project');
  });

  afterEach(() => {
    rs.restoreAllMocks();
  });

  describe('CI environment', () => {
    it('should return null in CI environment', () => {
      rs.mocked(isCIEnv).mockReturnValue(true);

      const result = resolveCredentials('gcp', 'dev');

      expect(result).toBeNull();
      expect(loadCredentialsFile).not.toHaveBeenCalled();
    });

    it('should not load credentials file in CI', () => {
      rs.mocked(isCIEnv).mockReturnValue(true);

      resolveCredentials('gcp', 'prod');

      expect(findProjectRoot).not.toHaveBeenCalled();
      expect(loadCredentialsFile).not.toHaveBeenCalled();
    });
  });

  describe('Local environment', () => {
    beforeEach(() => {
      rs.mocked(isCIEnv).mockReturnValue(false);
    });

    it('should load credentials from file for specified environment', () => {
      rs.mocked(loadCredentialsFile).mockReturnValue({
        dev: mockCredentials,
        staging: { ...mockCredentials, project_id: 'staging-project' },
      });

      const result = resolveCredentials('gcp', 'dev');

      expect(result).toEqual(mockCredentials);
      expect(findProjectRoot).toHaveBeenCalled();
      expect(loadCredentialsFile).toHaveBeenCalledWith('/test/project', 'gcp');
    });

    it('should throw error when environment not found', () => {
      rs.mocked(loadCredentialsFile).mockReturnValue({
        dev: mockCredentials,
      });

      expect(() => {
        resolveCredentials('gcp', 'prod');
      }).toThrow('No credentials found for environment "prod"');
    });

    it('should work with different providers', () => {
      rs.mocked(loadCredentialsFile).mockReturnValue({
        dev: mockCredentials,
      });

      resolveCredentials('aws', 'dev');

      expect(loadCredentialsFile).toHaveBeenCalledWith('/test/project', 'aws');
    });
  });
});
