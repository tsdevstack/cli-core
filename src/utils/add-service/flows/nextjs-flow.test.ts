import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import * as childProcessModule from 'child_process';
import * as fsModule from 'fs';
import * as configModule from '../../config';
import * as loggerModule from '../../logger';
import * as pathsModule from '../../paths';
import { nextjsFlow } from './nextjs-flow';
import type { FrameworkConfig } from '../../config/types';

rs.mock('child_process', { mock: true });
rs.mock('fs', { mock: true });
rs.mock('../../config', { mock: true });
rs.mock('../../logger', { mock: true });
rs.mock('../../paths', { mock: true });

describe('nextjsFlow', () => {
  const mockLogger = {
    newline: rs.fn(),
    info: rs.fn(),
    warn: rs.fn(),
    success: rs.fn(),
    complete: rs.fn(),
  };

  const mockConfig: FrameworkConfig = {
    project: { name: 'test-project', version: '1.0.0' },
    cloud: { provider: null },
    services: [],
  };

  beforeEach(() => {
    rs.clearAllMocks();

    rs.mocked(loggerModule.logger).newline = mockLogger.newline;
    rs.mocked(loggerModule.logger).info = mockLogger.info;
    rs.mocked(loggerModule.logger).warn = mockLogger.warn;
    rs.mocked(loggerModule.logger).success = mockLogger.success;
    rs.mocked(loggerModule.logger).complete = mockLogger.complete;

    rs.mocked(pathsModule.findProjectRoot).mockReturnValue('/mock/project');
    rs.mocked(childProcessModule.spawnSync).mockReturnValue({
      status: 0,
      stdout: Buffer.from(''),
      stderr: Buffer.from(''),
      pid: 123,
      output: [],
      signal: null,
    });
  });

  describe('Scaffolding', () => {
    it('should run create-next-app with correct arguments', async () => {
      rs.mocked(fsModule.existsSync).mockReturnValue(false);

      await nextjsFlow('my-frontend', 3000, { ...mockConfig, services: [] });

      expect(childProcessModule.spawnSync).toHaveBeenCalledWith(
        'npx',
        ['create-next-app@latest', '/mock/project/apps/my-frontend'],
        expect.objectContaining({ cwd: '/mock/project', stdio: 'inherit' }),
      );
    });

    it('should throw when create-next-app fails', async () => {
      rs.mocked(childProcessModule.spawnSync).mockReturnValue({
        status: 1,
        stdout: Buffer.from(''),
        stderr: Buffer.from('Error'),
        pid: 123,
        output: [],
        signal: null,
      });

      await expect(
        nextjsFlow('my-frontend', 3000, { ...mockConfig, services: [] }),
      ).rejects.toThrow('Failed to create Next.js app');
    });
  });

  describe('Config file update', () => {
    it('should find next.config.ts first', async () => {
      rs.mocked(fsModule.existsSync).mockImplementation((p) =>
        (p as string).endsWith('next.config.ts'),
      );
      rs.mocked(fsModule.readFileSync).mockReturnValue(
        'const nextConfig = {};\nexport default nextConfig;',
      );

      await nextjsFlow('my-frontend', 3000, { ...mockConfig, services: [] });

      expect(fsModule.readFileSync).toHaveBeenCalledWith(
        '/mock/project/apps/my-frontend/next.config.ts',
        'utf-8',
      );
    });

    it('should add output standalone for "const nextConfig = {"', async () => {
      rs.mocked(fsModule.existsSync).mockImplementation((p) =>
        (p as string).endsWith('next.config.ts'),
      );
      rs.mocked(fsModule.readFileSync).mockReturnValue(
        'const nextConfig = {\n};\nexport default nextConfig;',
      );

      await nextjsFlow('my-frontend', 3000, { ...mockConfig, services: [] });

      expect(fsModule.writeFileSync).toHaveBeenCalledWith(
        '/mock/project/apps/my-frontend/next.config.ts',
        expect.stringContaining('output: "standalone"'),
      );
    });

    it('should add output standalone for "const nextConfig: NextConfig = {"', async () => {
      rs.mocked(fsModule.existsSync).mockImplementation((p) =>
        (p as string).endsWith('next.config.ts'),
      );
      rs.mocked(fsModule.readFileSync).mockReturnValue(
        'const nextConfig: NextConfig = {\n};\nexport default nextConfig;',
      );

      await nextjsFlow('my-frontend', 3000, { ...mockConfig, services: [] });

      expect(fsModule.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('output: "standalone"'),
      );
    });

    it('should not modify config that already includes output', async () => {
      rs.mocked(fsModule.existsSync).mockImplementation((p) =>
        (p as string).endsWith('next.config.ts'),
      );
      rs.mocked(fsModule.readFileSync).mockReturnValue(
        'const nextConfig = {\n  output: "standalone",\n};',
      );

      await nextjsFlow('my-frontend', 3000, { ...mockConfig, services: [] });

      expect(fsModule.writeFileSync).not.toHaveBeenCalled();
    });

    it('should warn when no next.config file found', async () => {
      rs.mocked(fsModule.existsSync).mockReturnValue(false);

      await nextjsFlow('my-frontend', 3000, { ...mockConfig, services: [] });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not find next.config'),
      );
    });

    it('should handle config update failure gracefully', async () => {
      rs.mocked(fsModule.existsSync).mockImplementation((p) =>
        (p as string).endsWith('next.config.ts'),
      );
      rs.mocked(fsModule.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      await nextjsFlow('my-frontend', 3000, { ...mockConfig, services: [] });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not update next.config'),
      );
    });
  });

  describe('Config registration', () => {
    it('should register service with correct shape', async () => {
      rs.mocked(fsModule.existsSync).mockReturnValue(false);
      const config = {
        ...mockConfig,
        services: [] as FrameworkConfig['services'],
      };

      await nextjsFlow('my-frontend', 3000, config);

      expect(config.services).toHaveLength(1);
      expect(config.services[0]).toEqual({
        name: 'my-frontend',
        type: 'nextjs',
        port: 3000,
        hasDatabase: false,
      });
    });

    it('should save framework config', async () => {
      rs.mocked(fsModule.existsSync).mockReturnValue(false);

      await nextjsFlow('my-frontend', 3000, { ...mockConfig, services: [] });

      expect(configModule.saveFrameworkConfig).toHaveBeenCalledTimes(1);
    });
  });
});
