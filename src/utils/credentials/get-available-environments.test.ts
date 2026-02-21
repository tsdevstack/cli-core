import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockLoadCredentialsFile } = rs.hoisted(() => ({
  mockLoadCredentialsFile: rs.fn(),
}));

rs.mock('./load-credentials-file', () => ({
  loadCredentialsFile: mockLoadCredentialsFile,
}));

import { getAvailableEnvironments } from './get-available-environments';

describe('getAvailableEnvironments', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should return environment keys from credentials file', () => {
    mockLoadCredentialsFile.mockReturnValue({
      dev: { project_id: 'proj-dev' },
      staging: { project_id: 'proj-staging' },
      prod: { project_id: 'proj-prod' },
    });

    const envs = getAvailableEnvironments('/project', 'gcp');

    expect(envs).toEqual(['dev', 'staging', 'prod']);
  });

  it('should return empty array when no environments configured', () => {
    mockLoadCredentialsFile.mockReturnValue({});

    const envs = getAvailableEnvironments('/project', 'aws');

    expect(envs).toEqual([]);
  });

  it('should pass correct args to loadCredentialsFile', () => {
    mockLoadCredentialsFile.mockReturnValue({ dev: {} });

    getAvailableEnvironments('/my/project', 'azure');

    expect(mockLoadCredentialsFile).toHaveBeenCalledWith(
      '/my/project',
      'azure',
    );
  });
});
