import { describe, it, expect } from '@rstest/core';
import { generateRustfsService } from './rustfs-service';
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

describe('generateRustfsService', () => {
  describe('when no buckets configured', () => {
    it('should return empty object when storage is undefined', () => {
      const result = generateRustfsService(makeConfig(), 'test-network');

      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should return empty object when buckets array is empty', () => {
      const result = generateRustfsService(makeConfig([]), 'test-network');

      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('rustfs service', () => {
    it('should use a pinned RustFS image', () => {
      const result = generateRustfsService(makeConfig(['uploads']), 'net');

      expect(result.rustfs.image).toBe('rustfs/rustfs:1.0.3');
    });

    it('should run as root so the bind mount is writable on every host', () => {
      const result = generateRustfsService(makeConfig(['uploads']), 'net');

      expect(result.rustfs.user).toBe('0:0');
    });

    it('should expose API and console ports', () => {
      const result = generateRustfsService(makeConfig(['uploads']), 'net');

      expect(result.rustfs.ports).toEqual(['9000:9000', '9001:9001']);
    });

    it('should set credentials from the storage secrets and enable the console', () => {
      const result = generateRustfsService(makeConfig(['uploads']), 'net');
      const env = result.rustfs.environment as Record<string, string>;

      expect(env.RUSTFS_ACCESS_KEY).toBe('${STORAGE_ACCESS_KEY}');
      expect(env.RUSTFS_SECRET_KEY).toBe('${STORAGE_SECRET_KEY}');
      expect(env.RUSTFS_ADDRESS).toBe(':9000');
      expect(env.RUSTFS_CONSOLE_ENABLE).toBe('true');
      expect(env.RUSTFS_CONSOLE_ADDRESS).toBe(':9001');
    });

    it('should mount the data directory as a bind mount under ./data', () => {
      const result = generateRustfsService(makeConfig(['uploads']), 'net');

      expect(result.rustfs.volumes).toEqual(['./data/rustfs:/data']);
    });

    it('should check health on the /health endpoint', () => {
      const result = generateRustfsService(makeConfig(['uploads']), 'net');

      expect(result.rustfs.healthcheck?.test).toEqual([
        'CMD',
        'curl',
        '-sf',
        'http://localhost:9000/health',
      ]);
      expect(result.rustfs.healthcheck?.start_period).toBe('5s');
    });

    it('should connect to the project network and restart always', () => {
      const result = generateRustfsService(makeConfig(['uploads']), 'my-net');

      expect(result.rustfs.networks).toEqual(['my-net']);
      expect(result.rustfs.restart).toBe('always');
    });
  });

  describe('rustfs-init service', () => {
    it('should use a pinned s5cmd image', () => {
      const result = generateRustfsService(makeConfig(['uploads']), 'net');

      expect(result['rustfs-init'].image).toBe('peakcom/s5cmd:v2.3.0');
    });

    it('should wait for a healthy rustfs', () => {
      const result = generateRustfsService(makeConfig(['uploads']), 'net');

      expect(result['rustfs-init'].depends_on).toEqual({
        rustfs: { condition: 'service_healthy' },
      });
    });

    it('should pass the storage credentials as AWS SDK variables', () => {
      const result = generateRustfsService(makeConfig(['uploads']), 'net');
      const env = result['rustfs-init'].environment as Record<string, string>;

      expect(env.AWS_ACCESS_KEY_ID).toBe('${STORAGE_ACCESS_KEY}');
      expect(env.AWS_SECRET_ACCESS_KEY).toBe('${STORAGE_SECRET_KEY}');
      expect(env.AWS_REGION).toBe('us-east-1');
    });

    it('should create one bucket idempotently with the project-name-dev format', () => {
      const result = generateRustfsService(makeConfig(['uploads']), 'net');
      const entrypoint = result['rustfs-init'].entrypoint as string[];

      expect(entrypoint[0]).toBe('/bin/sh');
      expect(entrypoint[1]).toBe('-c');
      expect(entrypoint[2]).toBe(
        '(/s5cmd --endpoint-url http://rustfs:9000 ls s3://myapp-uploads-dev >/dev/null 2>&1 || /s5cmd --endpoint-url http://rustfs:9000 mb s3://myapp-uploads-dev)',
      );
    });

    it('should chain several buckets with &&', () => {
      const result = generateRustfsService(
        makeConfig(['uploads', 'avatars']),
        'net',
      );
      const script = (result['rustfs-init'].entrypoint as string[])[2];

      expect(script.split(' && ')).toHaveLength(2);
      expect(script).toContain('s3://myapp-uploads-dev');
      expect(script).toContain('s3://myapp-avatars-dev');
    });

    it('should contain no dollar signs that compose would interpolate', () => {
      const result = generateRustfsService(makeConfig(['uploads']), 'net');
      const script = (result['rustfs-init'].entrypoint as string[])[2];

      expect(script).not.toContain('$');
    });

    it('should connect to the project network', () => {
      const result = generateRustfsService(makeConfig(['uploads']), 'my-net');

      expect(result['rustfs-init'].networks).toEqual(['my-net']);
    });
  });
});
