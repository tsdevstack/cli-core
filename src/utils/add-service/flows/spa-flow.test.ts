import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import * as childProcessModule from 'child_process';
import * as fsModule from 'fs';
import * as configModule from '../../config';
import * as loggerModule from '../../logger';
import * as pathsModule from '../../paths';
import * as fsCoreModule from '../../fs';
import { spaFlow } from './spa-flow';
import type { FrameworkConfig } from '../../config/types';

rs.mock('child_process', { mock: true });
rs.mock('fs', { mock: true });
rs.mock('../../config', { mock: true });
rs.mock('../../logger', { mock: true });
rs.mock('../../paths', { mock: true });
rs.mock('../../fs', { mock: true });

describe('spaFlow', () => {
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
    rs.mocked(fsCoreModule.readJsonFile).mockReturnValue({
      name: 'rsbuild-app',
    });
  });

  describe('Scaffolding', () => {
    it('should run create-rsbuild with correct arguments', async () => {
      rs.mocked(fsModule.existsSync).mockReturnValue(false);

      await spaFlow('my-spa', 3100, { ...mockConfig, services: [] });

      expect(childProcessModule.spawnSync).toHaveBeenCalledWith(
        'npm',
        [
          'create',
          'rsbuild@latest',
          '--',
          '--dir',
          '/mock/project/apps/my-spa',
        ],
        expect.objectContaining({ cwd: '/mock/project', stdio: 'inherit' }),
      );
    });

    it('should throw when create-rsbuild fails', async () => {
      rs.mocked(childProcessModule.spawnSync).mockReturnValue({
        status: 1,
        stdout: Buffer.from(''),
        stderr: Buffer.from('Error'),
        pid: 123,
        output: [],
        signal: null,
      });

      await expect(
        spaFlow('my-spa', 3100, { ...mockConfig, services: [] }),
      ).rejects.toThrow('Failed to create SPA');
    });
  });

  describe('Package.json update', () => {
    it('should update package.json name to service name', async () => {
      rs.mocked(fsModule.existsSync).mockReturnValue(false);

      await spaFlow('my-spa', 3100, { ...mockConfig, services: [] });

      expect(fsCoreModule.readJsonFile).toHaveBeenCalledWith(
        '/mock/project/apps/my-spa/package.json',
      );
      expect(fsCoreModule.writeJsonFile).toHaveBeenCalledWith(
        '/mock/project/apps/my-spa/package.json',
        expect.objectContaining({ name: 'my-spa' }),
      );
    });

    it('should handle package.json update failure gracefully', async () => {
      rs.mocked(fsCoreModule.readJsonFile).mockImplementation(() => {
        throw new Error('Read error');
      });
      rs.mocked(fsModule.existsSync).mockReturnValue(false);

      await spaFlow('my-spa', 3100, { ...mockConfig, services: [] });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not update package.json'),
      );
    });
  });

  describe('Rsbuild config update', () => {
    it('should find rsbuild.config.ts first', async () => {
      rs.mocked(fsModule.existsSync).mockImplementation((p) =>
        (p as string).endsWith('rsbuild.config.ts'),
      );
      rs.mocked(fsModule.readFileSync).mockReturnValue(
        'import { defineConfig } from "@rsbuild/core";\nexport default defineConfig({\n});',
      );

      await spaFlow('my-spa', 3100, { ...mockConfig, services: [] });

      expect(fsModule.readFileSync).toHaveBeenCalledWith(
        '/mock/project/apps/my-spa/rsbuild.config.ts',
        'utf-8',
      );
    });

    it('should add server.port to config when no server key exists', async () => {
      rs.mocked(fsModule.existsSync).mockImplementation((p) =>
        (p as string).endsWith('rsbuild.config.ts'),
      );
      rs.mocked(fsModule.readFileSync).mockReturnValue(
        'import { defineConfig } from "@rsbuild/core";\nexport default defineConfig({\n});',
      );

      await spaFlow('my-spa', 3100, { ...mockConfig, services: [] });

      expect(fsModule.writeFileSync).toHaveBeenCalledWith(
        '/mock/project/apps/my-spa/rsbuild.config.ts',
        expect.stringContaining('port: 3100'),
      );
    });

    it('should not modify config that already includes server', async () => {
      rs.mocked(fsModule.existsSync).mockImplementation((p) =>
        (p as string).endsWith('rsbuild.config.ts'),
      );
      rs.mocked(fsModule.readFileSync).mockReturnValue(
        'export default defineConfig({\n  server: { port: 3000 },\n});',
      );

      await spaFlow('my-spa', 3100, { ...mockConfig, services: [] });

      expect(fsModule.writeFileSync).not.toHaveBeenCalled();
    });

    it('should warn when no rsbuild.config file found', async () => {
      rs.mocked(fsModule.existsSync).mockReturnValue(false);

      await spaFlow('my-spa', 3100, { ...mockConfig, services: [] });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not find rsbuild.config'),
      );
    });

    it('should handle config update failure gracefully', async () => {
      rs.mocked(fsModule.existsSync).mockImplementation((p) =>
        (p as string).endsWith('rsbuild.config.ts'),
      );
      rs.mocked(fsModule.readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      await spaFlow('my-spa', 3100, { ...mockConfig, services: [] });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not update rsbuild.config'),
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

      await spaFlow('my-spa', 3100, config);

      expect(config.services).toHaveLength(1);
      expect(config.services[0]).toEqual({
        name: 'my-spa',
        type: 'spa',
        port: 3100,
        hasDatabase: false,
      });
    });

    it('should save framework config', async () => {
      rs.mocked(fsModule.existsSync).mockReturnValue(false);

      await spaFlow('my-spa', 3100, { ...mockConfig, services: [] });

      expect(configModule.saveFrameworkConfig).toHaveBeenCalledTimes(1);
    });
  });
});
