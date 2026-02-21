import { describe, it, expect } from '@rstest/core';
import { join } from 'path';
import { getCredentialsPath } from './get-credentials-path';

describe('getCredentialsPath', () => {
  it('should build GCP credentials path', () => {
    const result = getCredentialsPath('/project', 'gcp');
    expect(result).toBe(
      join('/project', '.tsdevstack', '.credentials.gcp.json'),
    );
  });

  it('should build AWS credentials path', () => {
    const result = getCredentialsPath('/project', 'aws');
    expect(result).toBe(
      join('/project', '.tsdevstack', '.credentials.aws.json'),
    );
  });

  it('should build Azure credentials path', () => {
    const result = getCredentialsPath('/project', 'azure');
    expect(result).toBe(
      join('/project', '.tsdevstack', '.credentials.azure.json'),
    );
  });
});
