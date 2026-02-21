import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';
import { getAWSCredentialsFromEnv } from './get-aws-credentials-from-env';

describe('getAWSCredentialsFromEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    rs.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Standard use cases', () => {
    it('should return credentials from environment variables', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIATEST123';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret123';
      process.env.AWS_REGION = 'us-east-1';
      process.env.AWS_ACCOUNT_ID = '123456789012';

      const result = getAWSCredentialsFromEnv();

      expect(result).toEqual({
        accessKeyId: 'AKIATEST123',
        secretAccessKey: 'secret123',
        region: 'us-east-1',
        accountId: '123456789012',
      });
    });

    it('should use AWS_DEFAULT_REGION as fallback', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIATEST123';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret123';
      process.env.AWS_DEFAULT_REGION = 'eu-west-1';

      const result = getAWSCredentialsFromEnv();

      expect(result.region).toBe('eu-west-1');
    });

    it('should work without AWS_ACCOUNT_ID (empty string)', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIATEST123';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret123';
      process.env.AWS_REGION = 'us-east-1';

      const result = getAWSCredentialsFromEnv();

      expect(result.accountId).toBe('');
    });
  });

  describe('Error handling', () => {
    it('should throw when AWS_ACCESS_KEY_ID is missing', () => {
      process.env.AWS_SECRET_ACCESS_KEY = 'secret123';
      process.env.AWS_REGION = 'us-east-1';

      expect(() => getAWSCredentialsFromEnv()).toThrow(
        'No AWS access key found',
      );
    });

    it('should throw when AWS_SECRET_ACCESS_KEY is missing', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIATEST123';
      process.env.AWS_REGION = 'us-east-1';

      expect(() => getAWSCredentialsFromEnv()).toThrow(
        'No AWS secret access key found',
      );
    });

    it('should throw when region is missing', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIATEST123';
      process.env.AWS_SECRET_ACCESS_KEY = 'secret123';

      expect(() => getAWSCredentialsFromEnv()).toThrow('No AWS region found');
    });
  });
});
