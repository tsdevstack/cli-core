import { describe, it, expect } from '@rstest/core';
import { validateBucketName } from './validate-bucket-name';
import { CliError } from '../errors';
import type { FrameworkConfig } from '../config';

function createConfig(
  overrides: Partial<FrameworkConfig> = {},
): FrameworkConfig {
  // Project name "myapp" keeps Azure account name short:
  // "myapp" (5) + "staging" (7) + "storage" (7) = 19 ≤ 24
  return {
    project: { name: 'myapp', version: '1.0.0' },
    cloud: { provider: null },
    services: [],
    ...overrides,
  };
}

describe('validateBucketName', () => {
  describe('valid bucket names', () => {
    it('should pass for simple names', () => {
      const config = createConfig();
      expect(() => validateBucketName('uploads', config)).not.toThrow();
      expect(() => validateBucketName('media', config)).not.toThrow();
      expect(() => validateBucketName('export-data', config)).not.toThrow();
    });

    it('should pass for names with numbers', () => {
      const config = createConfig();
      expect(() => validateBucketName('uploads2', config)).not.toThrow();
      expect(() => validateBucketName('data-v2', config)).not.toThrow();
    });

    it('should pass for minimum length name (2 chars)', () => {
      const config = createConfig();
      expect(() => validateBucketName('ab', config)).not.toThrow();
    });

    it('should pass for maximum length name (30 chars)', () => {
      const config = createConfig();
      const name = 'a' + 'b'.repeat(28) + 'c'; // 30 chars
      expect(() => validateBucketName(name, config)).not.toThrow();
    });
  });

  describe('uppercase letters', () => {
    it('should throw for names with uppercase letters', () => {
      const config = createConfig();
      expect(() => validateBucketName('Uploads', config)).toThrow(CliError);
      expect(() => validateBucketName('MEDIA', config)).toThrow(CliError);
    });

    it('should include helpful message', () => {
      const config = createConfig();
      try {
        validateBucketName('Uploads', config);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).message).toContain('uppercase letters');
        expect((error as CliError).message).toContain('must be all lowercase');
      }
    });
  });

  describe('invalid characters', () => {
    it('should throw for names with underscores', () => {
      const config = createConfig();
      expect(() => validateBucketName('user_media', config)).toThrow(CliError);
    });

    it('should suggest hyphens instead of underscores', () => {
      const config = createConfig();
      try {
        validateBucketName('user_media', config);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).message).toContain(
          'hyphens instead of underscores',
        );
      }
    });

    it('should throw for names with special characters', () => {
      const config = createConfig();
      expect(() => validateBucketName('user.media', config)).toThrow(CliError);
      expect(() => validateBucketName('user@media', config)).toThrow(CliError);
      expect(() => validateBucketName('user media', config)).toThrow(CliError);
    });
  });

  describe('must start with letter', () => {
    it('should throw for names starting with number', () => {
      const config = createConfig();
      expect(() => validateBucketName('1uploads', config)).toThrow(CliError);
    });

    it('should throw for names starting with hyphen', () => {
      const config = createConfig();
      expect(() => validateBucketName('-uploads', config)).toThrow(CliError);
    });
  });

  describe('cannot start or end with hyphen', () => {
    it('should throw for names ending with hyphen', () => {
      const config = createConfig();
      expect(() => validateBucketName('uploads-', config)).toThrow(CliError);
    });
  });

  describe('length validation', () => {
    it('should throw for single character name', () => {
      const config = createConfig();
      expect(() => validateBucketName('a', config)).toThrow(CliError);
    });

    it('should throw for names exceeding 30 chars', () => {
      const config = createConfig();
      const name = 'a'.repeat(31);
      try {
        validateBucketName(name, config);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).message).toContain('too long');
        expect((error as CliError).message).toContain('31 characters');
        expect((error as CliError).message).toContain('Maximum: 30');
      }
    });
  });

  describe('reserved names', () => {
    it('should throw for reserved infrastructure names', () => {
      const config = createConfig();
      expect(() => validateBucketName('gateway', config)).toThrow(CliError);
      expect(() => validateBucketName('kong', config)).toThrow(CliError);
      expect(() => validateBucketName('redis', config)).toThrow(CliError);
      expect(() => validateBucketName('postgres', config)).toThrow(CliError);
      expect(() => validateBucketName('minio', config)).toThrow(CliError);
      expect(() => validateBucketName('storage', config)).toThrow(CliError);
    });

    it('should include reserved names in error message', () => {
      const config = createConfig();
      try {
        validateBucketName('minio', config);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).message).toContain(
          'reserved for infrastructure',
        );
        expect((error as CliError).message).toContain('minio');
        expect((error as CliError).message).toContain('storage');
      }
    });
  });

  describe('duplicate detection', () => {
    it('should throw when bucket already exists in config', () => {
      const config = createConfig({
        storage: { buckets: ['uploads', 'media'] },
      });
      expect(() => validateBucketName('uploads', config)).toThrow(CliError);
    });

    it('should include existing buckets in error message', () => {
      const config = createConfig({
        storage: { buckets: ['uploads', 'media'] },
      });
      try {
        validateBucketName('uploads', config);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).message).toContain('already exists');
        expect((error as CliError).message).toContain('uploads, media');
      }
    });

    it('should pass when no storage config exists', () => {
      const config = createConfig();
      expect(() => validateBucketName('uploads', config)).not.toThrow();
    });
  });

  describe('cloud bucket name length', () => {
    it('should throw when cloud name exceeds 63 chars', () => {
      const longProjectName = 'a'.repeat(40);
      const config = createConfig({
        project: { name: longProjectName, version: '1.0.0' },
      });
      const longBucketName = 'b'.repeat(20);

      // {40}-{20}-{7 for staging} = 70 chars > 63
      try {
        validateBucketName(longBucketName, config);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).message).toContain('too long');
        expect((error as CliError).message).toContain('63 characters');
      }
    });

    it('should use custom environments for length check', () => {
      const config = createConfig({
        project: { name: 'a'.repeat(40), version: '1.0.0' },
        environments: {
          dev: {},
          'very-long-environment-name': {},
        },
      });

      // {40}-{2 for ab}-{27} = 71 chars > 63
      try {
        validateBucketName('ab', config);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).message).toContain('too long');
      }
    });
  });
});
