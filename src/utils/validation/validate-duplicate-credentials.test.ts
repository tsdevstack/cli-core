import { describe, it, expect } from '@rstest/core';
import { validateDuplicateCredentials } from './validate-duplicate-credentials';
import { CliError } from '../errors';

describe('validateDuplicateCredentials', () => {
  describe('GCP credentials', () => {
    it('should pass with unique project_ids', () => {
      const credentials = {
        dev: {
          project_id: 'project-dev',
          client_email: 'sa@dev.iam',
          region: 'us-central1',
        },
        staging: {
          project_id: 'project-staging',
          client_email: 'sa@stg.iam',
          region: 'us-central1',
        },
        prod: {
          project_id: 'project-prod',
          client_email: 'sa@prod.iam',
          region: 'us-central1',
        },
      };

      expect(() =>
        validateDuplicateCredentials(credentials, 'gcp'),
      ).not.toThrow();
    });

    it('should throw CliError with duplicate project_ids', () => {
      const credentials = {
        dev: {
          project_id: 'same-project',
          client_email: 'sa@dev.iam',
          region: 'us-central1',
        },
        staging: {
          project_id: 'same-project',
          client_email: 'sa@stg.iam',
          region: 'us-central1',
        },
      };

      expect(() => validateDuplicateCredentials(credentials, 'gcp')).toThrow(
        CliError,
      );
    });

    it('should include duplicate details in error', () => {
      const credentials = {
        dev: {
          project_id: 'shared-project',
          client_email: 'sa@dev.iam',
          region: 'us-central1',
        },
        staging: {
          project_id: 'shared-project',
          client_email: 'sa@stg.iam',
          region: 'us-central1',
        },
      };

      try {
        validateDuplicateCredentials(credentials, 'gcp');
        expect.fail('Should have thrown');
      } catch (error) {
        const cliError = error as CliError;
        expect(cliError.message).toContain('shared-project');
        expect(cliError.message).toContain('dev');
        expect(cliError.message).toContain('staging');
        expect(cliError.context).toBe('Environment Isolation Error');
      }
    });
  });

  describe('AWS credentials', () => {
    it('should pass with unique accountIds', () => {
      const credentials = {
        dev: {
          accountId: '111111111',
          accessKeyId: 'ak1',
          secretAccessKey: 'sk1',
          region: 'us-east-1',
        },
        prod: {
          accountId: '222222222',
          accessKeyId: 'ak2',
          secretAccessKey: 'sk2',
          region: 'us-east-1',
        },
      };

      expect(() =>
        validateDuplicateCredentials(credentials, 'aws'),
      ).not.toThrow();
    });

    it('should throw CliError with duplicate accountIds', () => {
      const credentials = {
        dev: {
          accountId: '111111111',
          accessKeyId: 'ak1',
          secretAccessKey: 'sk1',
          region: 'us-east-1',
        },
        staging: {
          accountId: '111111111',
          accessKeyId: 'ak2',
          secretAccessKey: 'sk2',
          region: 'us-east-1',
        },
      };

      expect(() => validateDuplicateCredentials(credentials, 'aws')).toThrow(
        CliError,
      );
    });
  });

  describe('Azure credentials', () => {
    it('should pass with unique subscriptionIds', () => {
      const credentials = {
        dev: {
          clientId: 'c1',
          tenantId: 't1',
          subscriptionId: 'sub-dev',
          location: 'eastus',
        },
        prod: {
          clientId: 'c2',
          tenantId: 't2',
          subscriptionId: 'sub-prod',
          location: 'eastus',
        },
      };

      expect(() =>
        validateDuplicateCredentials(credentials, 'azure'),
      ).not.toThrow();
    });

    it('should throw CliError with duplicate subscriptionIds', () => {
      const credentials = {
        dev: {
          clientId: 'c1',
          tenantId: 't1',
          subscriptionId: 'same-sub',
          location: 'eastus',
        },
        staging: {
          clientId: 'c2',
          tenantId: 't2',
          subscriptionId: 'same-sub',
          location: 'eastus',
        },
      };

      expect(() => validateDuplicateCredentials(credentials, 'azure')).toThrow(
        CliError,
      );
    });
  });

  describe('Edge cases', () => {
    it('should skip validation with single environment', () => {
      const credentials = {
        dev: {
          project_id: 'test',
          client_email: 'sa@test.iam',
          region: 'us-central1',
        },
      };

      expect(() =>
        validateDuplicateCredentials(credentials, 'gcp'),
      ).not.toThrow();
    });

    it('should skip validation with empty credentials', () => {
      expect(() => validateDuplicateCredentials({}, 'gcp')).not.toThrow();
    });

    it('should handle credentials with missing field values', () => {
      const credentials = {
        dev: { client_email: 'sa@dev.iam', region: 'us-central1' },
        staging: { client_email: 'sa@stg.iam', region: 'us-central1' },
      };

      expect(() =>
        validateDuplicateCredentials(credentials, 'gcp'),
      ).not.toThrow();
    });

    it('should handle unknown provider gracefully', () => {
      const credentials = {
        dev: { key: 'value1' },
        staging: { key: 'value2' },
      };

      expect(() =>
        validateDuplicateCredentials(credentials, 'unknown' as never),
      ).not.toThrow();
    });

    it('should detect multiple groups of duplicates', () => {
      const credentials = {
        dev: {
          project_id: 'dup-1',
          client_email: 'sa@dev.iam',
          region: 'us-central1',
        },
        staging: {
          project_id: 'dup-1',
          client_email: 'sa@stg.iam',
          region: 'us-central1',
        },
        prod: {
          project_id: 'dup-2',
          client_email: 'sa@p.iam',
          region: 'us-central1',
        },
        qa: {
          project_id: 'dup-2',
          client_email: 'sa@qa.iam',
          region: 'us-central1',
        },
      };

      try {
        validateDuplicateCredentials(credentials, 'gcp');
        expect.fail('Should have thrown');
      } catch (error) {
        const cliError = error as CliError;
        expect(cliError.message).toContain('dup-1');
        expect(cliError.message).toContain('dup-2');
      }
    });
  });
});
