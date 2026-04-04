import { describe, it, expect } from '@rstest/core';
import { generateMinioService } from './minio-service';
import type { FrameworkConfig } from '../../config';

function makeConfig(buckets?: string[]): FrameworkConfig {
  return {
    project: { name: 'myapp', version: '1.0.0', description: '' },
    framework: { version: '1.0.0', packageScope: '@myapp' },
    cloud: { provider: 'aws' },
    services: [],
    storage: buckets ? { buckets } : undefined,
  } as FrameworkConfig;
}

describe('generateMinioService', () => {
  describe('when no buckets configured', () => {
    it('should return empty object when storage is undefined', () => {
      const config = makeConfig();
      const result = generateMinioService(config, 'test-network');

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should return empty object when buckets array is empty', () => {
      const config = makeConfig([]);
      const result = generateMinioService(config, 'test-network');

      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('minio service', () => {
    it('should generate minio service with correct image', () => {
      const result = generateMinioService(makeConfig(['uploads']), 'net');

      expect(result.minio.image).toBe('minio/minio');
    });

    it('should configure server command with console address', () => {
      const result = generateMinioService(makeConfig(['uploads']), 'net');

      expect(result.minio.command).toBe(
        'server /data --console-address ":9001"',
      );
    });

    it('should expose API and console ports', () => {
      const result = generateMinioService(makeConfig(['uploads']), 'net');

      expect(result.minio.ports).toEqual(['9000:9000', '9001:9001']);
    });

    it('should set environment with docker-compose variable placeholders', () => {
      const result = generateMinioService(makeConfig(['uploads']), 'net');
      const env = result.minio.environment as Record<string, string>;

      expect(env.MINIO_ROOT_USER).toBe('${STORAGE_ACCESS_KEY}');
      expect(env.MINIO_ROOT_PASSWORD).toBe('${STORAGE_SECRET_KEY}');
    });

    it('should mount data volume as bind mount', () => {
      const result = generateMinioService(makeConfig(['uploads']), 'net');

      expect(result.minio.volumes).toEqual(['./data/minio:/data']);
    });

    it('should configure healthcheck', () => {
      const result = generateMinioService(makeConfig(['uploads']), 'net');

      expect(result.minio.healthcheck).toBeDefined();
      expect(result.minio.healthcheck?.test).toEqual([
        'CMD',
        'mc',
        'ready',
        'local',
      ]);
    });

    it('should connect to the project network', () => {
      const result = generateMinioService(makeConfig(['uploads']), 'my-net');

      expect(result.minio.networks).toEqual(['my-net']);
    });

    it('should set restart policy', () => {
      const result = generateMinioService(makeConfig(['uploads']), 'net');

      expect(result.minio.restart).toBe('always');
    });
  });

  describe('minio-init service', () => {
    it('should use minio/mc image', () => {
      const result = generateMinioService(makeConfig(['uploads']), 'net');

      expect(result['minio-init'].image).toBe('minio/mc');
    });

    it('should depend on minio with service_healthy condition', () => {
      const result = generateMinioService(makeConfig(['uploads']), 'net');

      expect(result['minio-init'].depends_on).toEqual({
        minio: { condition: 'service_healthy' },
      });
    });

    it('should pass storage credentials as environment variables', () => {
      const result = generateMinioService(makeConfig(['uploads']), 'net');
      const env = result['minio-init'].environment as Record<string, string>;

      expect(env.STORAGE_ACCESS_KEY).toBe('${STORAGE_ACCESS_KEY}');
      expect(env.STORAGE_SECRET_KEY).toBe('${STORAGE_SECRET_KEY}');
    });

    it('should create single bucket with project-name-dev format', () => {
      const result = generateMinioService(makeConfig(['uploads']), 'net');
      const entrypoint = result['minio-init'].entrypoint as string[];

      expect(entrypoint[0]).toBe('/bin/sh');
      expect(entrypoint[1]).toBe('-c');
      expect(entrypoint[2]).toContain(
        'mc mb --ignore-existing local/myapp-uploads-dev',
      );
    });

    it('should create multiple buckets', () => {
      const result = generateMinioService(
        makeConfig(['uploads', 'media', 'documents']),
        'net',
      );
      const entrypoint = result['minio-init'].entrypoint as string[];
      const script = entrypoint[2];

      expect(script).toContain(
        'mc mb --ignore-existing local/myapp-uploads-dev',
      );
      expect(script).toContain('mc mb --ignore-existing local/myapp-media-dev');
      expect(script).toContain(
        'mc mb --ignore-existing local/myapp-documents-dev',
      );
    });

    it('should set mc alias before creating buckets', () => {
      const result = generateMinioService(makeConfig(['uploads']), 'net');
      const entrypoint = result['minio-init'].entrypoint as string[];
      const script = entrypoint[2];

      expect(script).toMatch(/^mc alias set local/);
    });

    it('should use $$ for literal dollar signs in entrypoint', () => {
      const result = generateMinioService(makeConfig(['uploads']), 'net');
      const entrypoint = result['minio-init'].entrypoint as string[];
      const script = entrypoint[2];

      expect(script).toContain('$$STORAGE_ACCESS_KEY');
      expect(script).toContain('$$STORAGE_SECRET_KEY');
    });

    it('should connect to the project network', () => {
      const result = generateMinioService(makeConfig(['uploads']), 'net');

      expect(result['minio-init'].networks).toEqual(['net']);
    });
  });
});
