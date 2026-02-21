import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';
import { CliError } from '../errors';

rs.mock('node:fs', () => ({
  default: {
    existsSync: rs.fn(),
    readFileSync: rs.fn(),
  },
}));

import fs from 'node:fs';
import { getGCPCredentialsFromEnv } from './get-gcp-credentials-from-env';

describe('getGCPCredentialsFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    rs.clearAllMocks();
    process.env = { ...originalEnv };
    // Clear all relevant env vars
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    delete process.env.GCP_PROJECT_ID;
    delete process.env.GCP_REGION;
    delete process.env.GCP_SERVICE_ACCOUNT;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GCLOUD_PROJECT;
    delete process.env.CLOUDSDK_CORE_PROJECT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Mode 1: WIF via google-github-actions/auth', () => {
    it('should return credentials from WIF with env vars', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/creds.json';
      process.env.GCP_PROJECT_ID = 'my-project';
      process.env.GCP_REGION = 'us-central1';
      process.env.GCP_SERVICE_ACCOUNT = 'sa@my-project.iam.gserviceaccount.com';

      rs.mocked(fs.existsSync).mockReturnValue(true);

      const result = getGCPCredentialsFromEnv();

      expect(result).toEqual({
        project_id: 'my-project',
        client_email: 'sa@my-project.iam.gserviceaccount.com',
        region: 'us-central1',
      });
    });

    it('should read service account from credentials file when not set in env', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/creds.json';
      process.env.GCP_PROJECT_ID = 'my-project';
      process.env.GCP_REGION = 'us-central1';

      rs.mocked(fs.existsSync).mockReturnValue(true);
      rs.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          client_email: 'file-sa@my-project.iam.gserviceaccount.com',
        }),
      );

      const result = getGCPCredentialsFromEnv();

      expect(result.client_email).toBe(
        'file-sa@my-project.iam.gserviceaccount.com',
      );
    });

    it('should read project ID from credentials file when not in env', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/creds.json';
      process.env.GCP_REGION = 'us-central1';

      rs.mocked(fs.existsSync).mockReturnValue(true);
      rs.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          quota_project_id: 'file-project',
          client_email: 'sa@file-project.iam.gserviceaccount.com',
        }),
      );

      const result = getGCPCredentialsFromEnv();

      expect(result.project_id).toBe('file-project');
    });

    it('should throw CliError when region is missing in WIF mode', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/creds.json';
      process.env.GCP_PROJECT_ID = 'my-project';

      rs.mocked(fs.existsSync).mockReturnValue(true);
      rs.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ client_email: 'sa@test.iam.gserviceaccount.com' }),
      );

      expect(() => getGCPCredentialsFromEnv()).toThrow(CliError);
    });

    it('should use GOOGLE_CLOUD_PROJECT for project ID', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/creds.json';
      process.env.GOOGLE_CLOUD_PROJECT = 'cloud-project';
      process.env.GCP_REGION = 'us-east1';
      process.env.GCP_SERVICE_ACCOUNT =
        'sa@cloud-project.iam.gserviceaccount.com';

      rs.mocked(fs.existsSync).mockReturnValue(true);

      const result = getGCPCredentialsFromEnv();

      expect(result.project_id).toBe('cloud-project');
    });

    it('should generate default service account when not found', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/creds.json';
      process.env.GCP_PROJECT_ID = 'my-project';
      process.env.GCP_REGION = 'us-central1';

      rs.mocked(fs.existsSync).mockReturnValue(true);
      rs.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('read error');
      });

      const result = getGCPCredentialsFromEnv();

      expect(result.client_email).toBe(
        'wif-service-account@my-project.iam.gserviceaccount.com',
      );
    });
  });

  describe('Mode 2: Explicit ADC mode', () => {
    it('should return credentials from explicit env vars', () => {
      process.env.GCP_PROJECT_ID = 'adc-project';
      process.env.GCP_SERVICE_ACCOUNT =
        'adc-sa@adc-project.iam.gserviceaccount.com';
      process.env.GCP_REGION = 'europe-west1';

      const result = getGCPCredentialsFromEnv();

      expect(result).toEqual({
        project_id: 'adc-project',
        client_email: 'adc-sa@adc-project.iam.gserviceaccount.com',
        region: 'europe-west1',
      });
    });
  });

  describe('Mode 3: JSON key mode (legacy)', () => {
    it('should parse credentials from JSON env var', () => {
      const creds = {
        project_id: 'json-project',
        client_email: 'json-sa@json-project.iam.gserviceaccount.com',
        private_key:
          '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
      };
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify(creds);
      process.env.GCP_REGION = 'asia-east1';

      const result = getGCPCredentialsFromEnv();

      expect(result).toEqual({
        ...creds,
        region: 'asia-east1',
      });
    });

    it('should throw CliError when region is missing in JSON mode', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify({
        project_id: 'test',
        client_email: 'sa@test.iam.gserviceaccount.com',
      });

      expect(() => getGCPCredentialsFromEnv()).toThrow(CliError);
    });

    it('should throw CliError for invalid JSON', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = 'not valid json';
      process.env.GCP_REGION = 'us-central1';

      expect(() => getGCPCredentialsFromEnv()).toThrow(CliError);

      try {
        getGCPCredentialsFromEnv();
        expect.fail('Should have thrown');
      } catch (error) {
        const cliError = error as CliError;
        expect(cliError.message).toContain('Invalid');
      }
    });
  });

  describe('No credentials configured', () => {
    it('should throw CliError when no credentials are available', () => {
      expect(() => getGCPCredentialsFromEnv()).toThrow(CliError);
    });

    it('should include hint about available modes', () => {
      try {
        getGCPCredentialsFromEnv();
        expect.fail('Should have thrown');
      } catch (error) {
        const cliError = error as CliError;
        expect(cliError.message).toContain('No GCP credentials found');
        expect(cliError.context).toBe('CI');
      }
    });
  });
});
