import { describe, it, expect } from '@rstest/core';
import { buildGCPClientOptions } from './build-gcp-client-options';
import type { GCPCredentials } from '../cloud/types';

describe('buildGCPClientOptions', () => {
  it('should include credentials when private_key is present', () => {
    const creds: GCPCredentials = {
      project_id: 'my-project',
      client_email: 'sa@my-project.iam.gserviceaccount.com',
      private_key:
        '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
      region: 'us-central1',
    };

    const options = buildGCPClientOptions(creds);

    expect(options.projectId).toBe('my-project');
    expect(options.credentials).toEqual({
      client_email: 'sa@my-project.iam.gserviceaccount.com',
      private_key:
        '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
    });
  });

  it('should omit credentials when private_key is absent (ADC mode)', () => {
    const creds: GCPCredentials = {
      project_id: 'my-project',
      client_email: 'sa@my-project.iam.gserviceaccount.com',
      region: 'us-central1',
    };

    const options = buildGCPClientOptions(creds);

    expect(options.projectId).toBe('my-project');
    expect(options.credentials).toBeUndefined();
  });
});
